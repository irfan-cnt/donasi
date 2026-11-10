import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { buildAuditRow } from "@/lib/audit/audit-row";
import { getDb, getTxDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { auditLogs } from "@/lib/db/schema";
import type { Logger } from "@/lib/logger";
import { applyVerifiedStatus, type ApplyVerifiedStatusResult } from "../apply-verified-status";
import { MidtransError } from "../midtrans/errors";
import { redactPayload } from "../midtrans/redact";
import type { PaymentProvider, VerifiedWebhook } from "../types";

// Pemrosesan HTTP Notification Midtrans (P13, T-24; payment-architecture.md §5, §5b).
// Kebijakan kode respons mengikuti retry Midtrans (§3a #10): 2xx = selesai, tanpa retry;
// 503 = gangguan sementara di sisi kita/Midtrans (diretry 4×); 401 = signature salah.
// Event yang sudah tercatat (duplikat, anomali, order tak dikenal) selalu 200.

/** Notifikasi Midtrans ±1–2 KB; 16 KB memberi ruang tanpa membuka DoS body besar. */
export const MAX_WEBHOOK_BODY_BYTES = 16 * 1024;

/** Bentuk minimum sebelum disimpan (validasi ketat + signature di verifyWebhook). */
export const webhookShape = z.looseObject({
  order_id: z.string().min(1).max(100),
  transaction_id: z.string().min(1).max(100),
  transaction_status: z.string().min(1).max(50),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().min(1).max(30),
  signature_key: z.string().min(1).max(256),
});

export interface WebhookResponse {
  status: number;
  body: { ok: boolean; result: string };
}

export interface PaidJob {
  event: "payment.paid";
  transactionId: string;
  paymentId: string;
}

export interface MidtransWebhookDeps {
  provider: PaymentProvider | null;
  /** Publish notifikasi payment.paid (QStash). Tidak boleh melempar ke pemanggil. */
  publishPaid: (job: PaidJob, log: Logger) => Promise<void>;
  /** revalidateTag campaign (ter-throttle). Tidak boleh melempar ke pemanggil. */
  revalidateCampaign: (campaignId: string, log: Logger) => Promise<void>;
  /**
   * Dipanggil untuk setiap signature yang ditolak (rate limit per IP). true = batas terlampaui
   * → 429. Harus fail-open (false) bila Redis error.
   */
  onRejectedSignature: () => Promise<boolean>;
  log: Logger;
}

const res = (status: number, result: string, ok = status < 300): WebhookResponse => ({
  status,
  body: { ok, result },
});

/** Kode error MidtransError yang sementara → 503 agar Midtrans mengirim ulang. */
const TRANSIENT = new Set([
  "network",
  "timeout",
  "provider_unavailable",
  "rate_limited",
  "unauthorized",
]);

/** Nama/kode error saja (tanpa pesan yang mungkin berisi data). */
function errorCode(e: unknown): string {
  if (e instanceof MidtransError) return `midtrans:${e.code}`;
  const pg = pgCode(e);
  if (pg) return `db:${pg}`;
  return e instanceof Error ? e.name : "unknown";
}

function pgError(e: unknown): { code: string; constraint?: string } | undefined {
  for (let cur = e, i = 0; cur && i < 4; i++) {
    const { code, constraint } = cur as { code?: unknown; constraint?: unknown };
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return { code, constraint: typeof constraint === "string" ? constraint : undefined };
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}
const pgCode = (e: unknown) => pgError(e)?.code;

/** Constraint dedup webhook (drizzle/0001_initial_schema.sql). */
export const EVENT_DEDUP_CONSTRAINT = "payment_events_provider_event_key";

/** 23505 HANYA pada constraint dedup event = duplikat; unique violation lain = error (503). */
export function isEventDuplicateError(e: unknown): boolean {
  const pg = pgError(e);
  return pg?.code === "23505" && pg.constraint === EVENT_DEDUP_CONSTRAINT;
}

async function insertEvent(payload: unknown, orderId: string): Promise<string> {
  const isUuid = z.uuid().safeParse(orderId).success;
  const rows = await getDb().execute<{ id: string }>(sql`
    INSERT INTO payment_events (id, provider_id, payment_id, event_type, verification, result, payload)
    VALUES (${newId()}::uuid,
      (SELECT id FROM payment_providers WHERE code = 'midtrans'),
      ${isUuid ? sql`(SELECT id FROM payments WHERE id = ${orderId}::uuid)` : null},
      'notification', 'pending', 'received', ${JSON.stringify(payload)}::jsonb)
    RETURNING id`);
  return rows.rows[0]!.id;
}

async function markEvent(
  id: string,
  set: {
    verification?: "verified" | "rejected";
    result?: "duplicate" | "unknown_payment" | "error";
    error?: string | null;
    status?: string | null;
  },
): Promise<void> {
  await getDb().execute(sql`
    UPDATE payment_events SET
      verification = COALESCE(${set.verification ?? null}::event_verification, verification),
      result = COALESCE(${set.result ?? null}::event_result, result),
      error_message = ${set.error ?? null},
      status_reported = COALESCE(${set.status ?? null}, status_reported),
      processed_at = now()
    WHERE id = ${id}`);
}

async function auditWebhookIssue(action: string, eventRowId: string, metadata: object) {
  await getDb()
    .insert(auditLogs)
    .values(
      buildAuditRow({
        actor: { type: "provider" },
        action,
        entityType: "payment_event",
        entityId: eventRowId,
        metadata: metadata as Record<string, unknown>,
      }),
    );
}

/**
 * Proses satu notifikasi (body mentah sudah dibatasi ukurannya & content-type sudah dicek oleh
 * route). Urutan: Zod bentuk → simpan event (pending, ter-redaksi) → verifyWebhook (signature +
 * Get Status) → klaim provider_event_id + applyVerifiedStatus dalam SATU transaksi DB →
 * efek samping setelah commit.
 */
export async function handleMidtransWebhook(
  req: { headers: Headers; rawBody: string },
  deps: MidtransWebhookDeps,
): Promise<WebhookResponse> {
  const { log } = deps;

  let json: unknown;
  try {
    json = JSON.parse(req.rawBody);
  } catch {
    log.warn("webhook midtrans: body bukan JSON");
    return res(400, "invalid_json");
  }
  const shape = webhookShape.safeParse(json);
  if (!shape.success) {
    log.warn("webhook midtrans: bentuk payload tidak valid", {
      paths: shape.error.issues.map((i) => i.path.join(".")).slice(0, 10),
    });
    return res(400, "invalid_payload");
  }
  const orderId = shape.data.order_id;
  const elog = log.child({ orderId, transactionStatus: shape.data.transaction_status });

  if (!deps.provider) {
    // Salah konfigurasi (kunci belum diisi): minta Midtrans mengirim ulang nanti.
    elog.error("webhook midtrans: provider tidak terkonfigurasi");
    return res(503, "provider_unconfigured");
  }

  // 0) Signature lokal sebelum menulis apa pun: payload palsu tidak pernah masuk DB.
  if (!deps.provider.checkWebhookSignature({ headers: req.headers, rawBody: req.rawBody })) {
    const limited = await deps.onRejectedSignature().catch(() => false);
    elog.warn("webhook midtrans: signature ditolak (tidak disimpan)", { limited });
    return limited ? res(429, "rate_limited") : res(401, "rejected");
  }

  let eventRowId: string;
  try {
    eventRowId = await insertEvent(redactPayload(json), orderId);
  } catch (e) {
    elog.error("webhook midtrans: gagal menyimpan event", { error: errorCode(e) });
    return res(503, "store_failed");
  }
  const ilog = elog.child({ eventRowId });

  // 1) Verifikasi (signature SHA512 timing-safe + cross-check Get Status).
  let verified: VerifiedWebhook;
  try {
    verified = await deps.provider.verifyWebhook({ headers: req.headers, rawBody: req.rawBody });
  } catch (e) {
    const code = errorCode(e);
    const mcode = e instanceof MidtransError ? e.code : null;
    try {
      if (mcode === "invalid_signature") {
        await markEvent(eventRowId, { verification: "rejected", result: "error", error: code });
        ilog.warn("webhook midtrans: ditolak (signature/payload)");
        return res(401, "rejected");
      }
      if (mcode === "not_found") {
        // Signature valid tetapi Midtrans tidak mengenal order (mis. tes dari dashboard).
        await markEvent(eventRowId, {
          verification: "verified",
          result: "unknown_payment",
          error: code,
        });
        ilog.warn("webhook midtrans: order tidak dikenal Midtrans (disimpan)");
        return res(200, "unknown_payment");
      }
      if (mcode === null || TRANSIENT.has(mcode)) {
        if (mcode === "unauthorized") {
          // Get Status 401/403: server key salah/dicabut — semua webhook akan gagal sampai diperbaiki.
          ilog.error("payment.alert", { kind: "provider_auth", error: code });
        }
        await markEvent(eventRowId, { result: "error", error: code });
        ilog.error("webhook midtrans: verifikasi gagal sementara; minta retry", { error: code });
        return res(503, "retry");
      }
      // Permanen (unmapped_status mis. chargeback/authorize, transaction_id ≠ API, dll.):
      // retry tidak membantu → catat + alert, 200. Rekonsiliasi P14 tetap memeriksa.
      await markEvent(eventRowId, { verification: "rejected", result: "error", error: code });
      await auditWebhookIssue("payment.webhook_unverifiable", eventRowId, { orderId, error: code });
      ilog.error("payment.alert", { kind: "webhook_unverifiable", error: code });
      return res(200, "unverifiable");
    } catch (e2) {
      ilog.error("webhook midtrans: gagal mencatat hasil verifikasi", { error: errorCode(e2) });
      return res(503, "store_failed");
    }
  }

  // 2) Dedup + apply dalam satu transaksi: klaim provider_event_id (UNIQUE per provider). Request
  //    paralel dengan eventId sama menunggu di indeks unik; bila pemenang commit → 23505 →
  //    duplikat. Bila pemenang rollback, klaim berikutnya berhasil (tidak ada event yang hilang).
  let result: ApplyVerifiedStatusResult;
  try {
    result = await getTxDb().transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE payment_events SET provider_event_id = ${verified.eventId}, verification = 'verified'
        WHERE id = ${eventRowId}`);
      const applied = await applyVerifiedStatus(
        tx,
        {
          paymentId: verified.orderId,
          status: verified.status,
          amount: verified.amount,
          paidAt: verified.paidAt ?? null,
          source: "webhook",
          eventId: eventRowId,
          providerRef: verified.providerRef || null,
          needsReview: verified.needsReview,
        },
        ilog,
      );
      if (applied.becamePaid && applied.transactionId) {
        // Outbox: penanda di transaksi yang sama, agar notifikasi tidak hilang bila publish QStash
        // gagal setelah commit. P16/P14 wajib menguras audit `notification.pending` tanpa
        // padanan notification_logs (dedup_key event:trx:channel mencegah kirim ganda).
        await tx.insert(auditLogs).values(
          buildAuditRow({
            actor: { type: "system" },
            action: "notification.pending",
            entityType: "transaction",
            entityId: applied.transactionId,
            metadata: { event: "payment.paid", paymentId: verified.orderId },
          }),
        );
      }
      return applied;
    });
  } catch (e) {
    if (isEventDuplicateError(e)) {
      try {
        await markEvent(eventRowId, {
          verification: "verified",
          result: "duplicate",
          status: verified.status,
        });
      } catch (e2) {
        ilog.warn("webhook midtrans: gagal menandai duplikat", { error: errorCode(e2) });
      }
      ilog.info("webhook midtrans: event duplikat", { eventId: verified.eventId });
      return res(200, "duplicate");
    }
    const code = errorCode(e);
    ilog.error("webhook midtrans: apply gagal; minta retry", { error: code });
    try {
      await markEvent(eventRowId, { verification: "verified", result: "error", error: code });
    } catch {
      // sudah dilog di atas
    }
    return res(503, "retry");
  }

  // 3) Efek samping SETELAH commit (tidak pernah mengubah kode respons).
  if (result.alert) {
    // Audit sudah ditulis di dalam transaksi oleh applyVerifiedStatus; P16 mengirim email admin.
    ilog.error("payment.alert", {
      kind: result.alert.kind,
      paymentId: result.alert.paymentId,
      transactionId: result.alert.transactionId,
      reportedStatus: result.alert.reportedStatus,
    });
  }
  if (result.becamePaid && result.transactionId) {
    await deps
      .publishPaid(
        { event: "payment.paid", transactionId: result.transactionId, paymentId: verified.orderId },
        ilog,
      )
      .catch((e: unknown) => ilog.error("publish payment.paid gagal", { error: errorCode(e) }));
    if (result.campaignId) {
      await deps
        .revalidateCampaign(result.campaignId, ilog)
        .catch((e: unknown) => ilog.warn("revalidate campaign gagal", { error: errorCode(e) }));
    }
  }
  return res(200, result.outcome);
}
