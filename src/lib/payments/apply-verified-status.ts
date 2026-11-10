import "server-only";
import { sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { z } from "zod";
import { buildAuditRow } from "@/lib/audit/audit-row";
import { auditLogs, paymentEvents } from "@/lib/db/schema";
import type { Logger } from "@/lib/logger";
import { logger as rootLogger } from "@/lib/logger";
import { canTransition, canTransitionTransaction, deriveTransactionStatus } from "./state-machine";
import { TRANSACTION_TRANSITIONS } from "./state-machine";
import type { PaymentStatus, TransactionStatus } from "./types";

/** Transaksi interaktif Drizzle (WebSocket Pool, `getTxDb().transaction(...)`). */
export type PaymentTx = Parameters<Parameters<NeonDatabase["transaction"]>[0]>[0];

const STATUSES = [
  "created",
  "pending",
  "paid",
  "expired",
  "failed",
  "cancelled",
  "refunded",
] as const;

export const applyVerifiedStatusInput = z.object({
  /** = payments.id = order_id provider. String bebas: id tak dikenal → unknown_payment. */
  paymentId: z.string().min(1).max(100),
  status: z.enum(STATUSES),
  /** Nominal yang dilaporkan provider (bigint rupiah). Wajib untuk `paid`. */
  amount: z.bigint().nullable(),
  paidAt: z.date().nullable(),
  /** BR-18: hanya sumber terverifikasi. Redirect URL tidak pernah menjadi sumber. */
  source: z.enum(["webhook", "expiry_job", "reconcile", "admin_check"]),
  /** payment_events.id milik event yang sedang diproses (webhook) bila ada. */
  eventId: z.uuid().nullable(),
  providerRef: z.string().min(1).max(200).nullish(),
  /** Provider menandai butuh review manual (Midtrans capture+challenge, refund). */
  needsReview: z.boolean().optional(),
});
export type ApplyVerifiedStatusInput = z.input<typeof applyVerifiedStatusInput>;

export type ApplyOutcome =
  "processed" | "duplicate" | "ignored_transition" | "amount_mismatch" | "unknown_payment";

/** Alert internal admin; dikirim pemanggil SETELAH commit (hook notifikasi P16). */
export interface PaymentAlert {
  kind:
    | "amount_mismatch"
    | "paid_after_terminal"
    | "unknown_payment"
    | "refund_reported"
    | "needs_review";
  paymentId: string;
  transactionId: string | null;
  expectedAmount: bigint | null;
  reportedAmount: bigint | null;
  reportedStatus: PaymentStatus;
  source: string;
}

export interface ApplyVerifiedStatusResult {
  outcome: ApplyOutcome;
  /** true bila status payment berubah. */
  changed: boolean;
  /** true HANYA pada transisi pertama transaksi ke paid (BR-19) → kirim notifikasi. */
  becamePaid: boolean;
  previousStatus: PaymentStatus | null;
  newStatus: PaymentStatus | null;
  transactionId: string | null;
  transactionStatus: TransactionStatus | null;
  campaignId: string | null;
  receiptNo: string | null;
  alert: PaymentAlert | null;
}

interface PaymentRow {
  id: string;
  transaction_id: string;
  provider_id: string;
  amount: string;
  status: PaymentStatus;
  [k: string]: unknown;
}

/**
 * SATU-SATUNYA jalur perubahan status payment/transaksi (webhook, job expiry, rekonsiliasi,
 * tombol admin). Harus dipanggil di dalam `getTxDb().transaction(...)`. Efek samping
 * non-DB (notifikasi, revalidateTag, kirim alert) dilakukan pemanggil setelah commit
 * berdasarkan hasil yang dikembalikan.
 *
 * Penolakan (unknown/mismatch/transisi ilegal) TIDAK melempar error agar catatan anomali
 * ikut ter-commit.
 */
export async function applyVerifiedStatus(
  tx: PaymentTx,
  rawInput: ApplyVerifiedStatusInput,
  log: Logger = rootLogger,
): Promise<ApplyVerifiedStatusResult> {
  const input = applyVerifiedStatusInput.parse(rawInput);
  const base: ApplyVerifiedStatusResult = {
    outcome: "processed",
    changed: false,
    becamePaid: false,
    previousStatus: null,
    newStatus: null,
    transactionId: null,
    transactionStatus: null,
    campaignId: null,
    receiptNo: null,
    alert: null,
  };
  const plog = log.child({ paymentId: input.paymentId, source: input.source });

  // 1) Kunci baris payment. Pemanggil paralel untuk payment yang sama antre di sini.
  const isUuid = z.uuid().safeParse(input.paymentId).success;
  const locked = isUuid
    ? await tx.execute<PaymentRow>(sql`
        SELECT id, transaction_id, provider_id, amount::text AS amount, status
        FROM payments WHERE id = ${input.paymentId} FOR UPDATE`)
    : { rows: [] as PaymentRow[] };
  const p = locked.rows[0];

  if (!p) {
    const alert: PaymentAlert = {
      kind: "unknown_payment",
      paymentId: input.paymentId,
      transactionId: null,
      expectedAmount: null,
      reportedAmount: input.amount,
      reportedStatus: input.status,
      source: input.source,
    };
    await markEvent(tx, input, null, "unknown_payment", "payment tidak ditemukan");
    await writeAnomalyAudit(tx, "payment.unknown_payment", input.paymentId, alert);
    plog.warn("payment: unknown_payment", { status: input.status });
    return { ...base, outcome: "unknown_payment", alert };
  }

  const expected = BigInt(p.amount);
  const result = {
    ...base,
    previousStatus: p.status,
    newStatus: p.status,
    transactionId: p.transaction_id,
  };

  // 1b) Refund hanya boleh diterapkan lewat cek admin (M1: reversal total belum ada).
  //     Dari sumber lain → dicatat sebagai anomali + alert, status tidak berubah.
  if (input.status === "refunded" && input.source !== "admin_check") {
    const alert: PaymentAlert = {
      kind: "refund_reported",
      paymentId: p.id,
      transactionId: p.transaction_id,
      expectedAmount: expected,
      reportedAmount: input.amount,
      reportedStatus: input.status,
      source: input.source,
    };
    await markEvent(tx, input, p, "ignored_transition", "refund butuh review admin");
    await writeAnomalyAudit(tx, "payment.needs_review", p.id, alert);
    plog.error("payment: refund dilaporkan (needs_review)", { from: p.status });
    return { ...result, outcome: "ignored_transition", alert };
  }

  // 1c) Pending yang ditandai review (capture+challenge) → audit + alert, alur lanjut normal.
  if (input.needsReview && input.status === "pending") {
    const alert: PaymentAlert = {
      kind: "needs_review",
      paymentId: p.id,
      transactionId: p.transaction_id,
      expectedAmount: expected,
      reportedAmount: input.amount,
      reportedStatus: input.status,
      source: input.source,
    };
    await writeAnomalyAudit(tx, "payment.needs_review", p.id, alert);
    plog.warn("payment: pending needs_review (fraud challenge)", {});
    result.alert = alert;
  }

  // 2) Nominal wajib sama persis; `paid` tanpa nominal juga ditolak (tidak pernah paid).
  const mismatch =
    (input.amount !== null && input.amount !== expected) ||
    (input.status === "paid" && input.amount === null);
  if (mismatch) {
    const alert: PaymentAlert = {
      kind: "amount_mismatch",
      paymentId: p.id,
      transactionId: p.transaction_id,
      expectedAmount: expected,
      reportedAmount: input.amount,
      reportedStatus: input.status,
      source: input.source,
    };
    await markEvent(tx, input, p, "amount_mismatch", `expected ${expected}`);
    await writeAnomalyAudit(tx, "payment.amount_mismatch", p.id, alert);
    plog.error("payment: amount_mismatch", {
      expected,
      reported: input.amount,
      status: input.status,
    });
    return { ...result, outcome: "amount_mismatch", alert };
  }

  // 3) Status sama = event berulang (idempoten).
  if (p.status === input.status) {
    await markEvent(tx, input, p, "duplicate", null);
    return { ...result, outcome: "duplicate" };
  }

  // 4) State machine (BR-20). Event terlambat (mis. expired setelah paid) diabaikan.
  if (!canTransition(p.status, input.status)) {
    // Uang masuk ke payment yang sudah expired/cancelled (BR-17) → perlu review manual.
    const paidAfterTerminal = input.status === "paid";
    const transitionAlert: PaymentAlert | null = paidAfterTerminal
      ? {
          kind: "paid_after_terminal",
          paymentId: p.id,
          transactionId: p.transaction_id,
          expectedAmount: expected,
          reportedAmount: input.amount,
          reportedStatus: input.status,
          source: input.source,
        }
      : null;
    await markEvent(tx, input, p, "ignored_transition", `${p.status} -> ${input.status}`);
    await writeAnomalyAudit(
      tx,
      paidAfterTerminal ? "payment.needs_review" : "payment.ignored_transition",
      p.id,
      transitionAlert ?? { from: p.status, to: input.status, source: input.source },
    );
    (paidAfterTerminal ? plog.error : plog.warn)("payment: ignored_transition", {
      from: p.status,
      to: input.status,
    });
    return { ...result, outcome: "ignored_transition", alert: transitionAlert ?? result.alert };
  }

  // 5) Update payment (guard status lama; baris sudah terkunci).
  const isPaid = input.status === "paid";
  const paidAt = isPaid ? (input.paidAt ?? new Date()) : null;
  const paymentUpdate = await tx.execute(sql`
    UPDATE payments SET
      status = ${input.status},
      paid_at = CASE WHEN ${isPaid} THEN ${paidAt}::timestamptz ELSE paid_at END,
      provider_ref = COALESCE(provider_ref, ${input.providerRef ?? null}),
      last_checked_at = now(),
      updated_at = now()
    WHERE id = ${p.id} AND status = ${p.status}`);
  // Baris terkunci FOR UPDATE, jadi harus tepat 1; selain itu → rollback.
  if (paymentUpdate.rowCount !== 1) {
    throw new Error(`applyVerifiedStatus: payment update affected ${paymentUpdate.rowCount} rows`);
  }
  result.changed = true;
  result.newStatus = input.status;

  // 6) Turunkan status transaksi.
  const txStatus = deriveTransactionStatus(input.status);
  if (isPaid) {
    // BR-19: hanya transisi PERTAMA ke paid yang mengembalikan baris.
    const updated = await tx.execute<{ campaign_id: string; amount: string; paid_year: number }>(
      sql`
        UPDATE transactions SET status = 'paid', paid_at = ${paidAt}::timestamptz, updated_at = now()
        WHERE id = ${p.transaction_id} AND status NOT IN ('paid', 'refunded')
        RETURNING campaign_id, amount::text AS amount,
          extract(year FROM paid_at AT TIME ZONE 'Asia/Jakarta')::int AS paid_year`,
    );
    const row = updated.rows[0];
    // Total campaign harus memakai nominal yang terverifikasi; beda → rollback.
    if (row && BigInt(row.amount) !== expected) {
      throw new Error(
        "applyVerifiedStatus: transaction amount differs from verified payment amount",
      );
    }
    if (row) {
      await tx.execute(sql`
        UPDATE campaigns SET
          collected_amount = collected_amount + ${row.amount}::bigint,
          donor_count = donor_count + 1,
          updated_at = now()
        WHERE id = ${row.campaign_id}`);
      const seq = await tx.execute<{ last_seq: number }>(sql`
        INSERT INTO receipt_counters (year, last_seq) VALUES (${row.paid_year}, 1)
        ON CONFLICT (year) DO UPDATE SET last_seq = receipt_counters.last_seq + 1
        RETURNING last_seq`);
      const receiptNo = `KW/${row.paid_year}/${String(seq.rows[0]!.last_seq).padStart(6, "0")}`;
      await tx.execute(sql`
        UPDATE transactions SET receipt_no = ${receiptNo}, receipt_issued_at = now()
        WHERE id = ${p.transaction_id}`);
      Object.assign(result, {
        becamePaid: true,
        campaignId: row.campaign_id,
        receiptNo,
        transactionStatus: "paid",
      });
    } else {
      // Transaksi sudah paid lewat payment lain (BR-17): total tidak ditambah lagi.
      plog.error("payment: paid tapi transaksi sudah paid (needs_review)", {});
      const alert: PaymentAlert = {
        kind: "paid_after_terminal",
        paymentId: p.id,
        transactionId: p.transaction_id,
        expectedAmount: expected,
        reportedAmount: input.amount,
        reportedStatus: input.status,
        source: input.source,
      };
      await writeAnomalyAudit(tx, "payment.needs_review", p.id, alert);
      result.alert = alert;
    }
  } else if (txStatus) {
    const allowedFrom = (Object.keys(TRANSACTION_TRANSITIONS) as TransactionStatus[]).filter((s) =>
      canTransitionTransaction(s, txStatus),
    );
    // Status terminal hanya diturunkan bila tidak ada attempt lain yang pending/paid.
    const updated = await tx.execute<{ status: TransactionStatus }>(sql`
      UPDATE transactions t SET status = ${txStatus}, updated_at = now()
      WHERE t.id = ${p.transaction_id}
        AND t.status::text IN (${sql.join(
          allowedFrom.map((s) => sql`${s}`),
          sql`, `,
        )})
        AND NOT EXISTS (
          SELECT 1 FROM payments o WHERE o.transaction_id = t.id AND o.id <> ${p.id}
            AND o.status IN ('pending', 'paid'))
      RETURNING t.status`);
    result.transactionStatus = updated.rows[0]?.status ?? null;
  }

  await markEvent(tx, input, p, "processed", null);
  plog.info("payment: status applied", {
    from: p.status,
    to: input.status,
    becamePaid: result.becamePaid,
  });
  return result;
}

type EventResult =
  "processed" | "duplicate" | "ignored_transition" | "amount_mismatch" | "unknown_payment";

/**
 * Catat hasil ke payment_events: update event webhook bila `eventId` ada; untuk sumber
 * non-webhook hanya anomali yang dicatat (baris baru, event_type `internal.<source>`).
 * Payment tak dikenal tanpa event → hanya audit_logs (payment_events butuh provider_id).
 */
async function markEvent(
  tx: PaymentTx,
  input: z.output<typeof applyVerifiedStatusInput>,
  p: PaymentRow | null,
  result: EventResult,
  errorMessage: string | null,
): Promise<void> {
  if (input.eventId) {
    await tx.execute(sql`
      UPDATE payment_events SET result = ${result}, payment_id = COALESCE(payment_id, ${p?.id ?? null}::uuid),
        status_reported = ${input.status}, amount_reported = ${input.amount},
        error_message = ${errorMessage}, processed_at = now()
      WHERE id = ${input.eventId}`);
    return;
  }
  if (!p || result === "processed" || result === "duplicate") return;
  await tx.insert(paymentEvents).values({
    providerId: p.provider_id,
    paymentId: p.id,
    eventType: `internal.${input.source}`,
    verification: "verified",
    result,
    statusReported: input.status,
    amountReported: input.amount,
    payload: {
      source: input.source,
      status: input.status,
      amount: input.amount?.toString() ?? null,
    },
    errorMessage,
    processedAt: new Date(),
  });
}

async function writeAnomalyAudit(
  tx: PaymentTx,
  action: string,
  paymentId: string,
  detail: object,
): Promise<void> {
  const metadata = JSON.parse(
    JSON.stringify(detail, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)),
  ) as Record<string, unknown>;
  await tx.insert(auditLogs).values(
    buildAuditRow({
      actor: { type: "system" },
      action,
      entityType: "payment",
      entityId: paymentId,
      metadata,
    }),
  );
}
