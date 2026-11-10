import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { MidtransError } from "@/lib/payments/midtrans/errors";
import type { PaymentStatus, ProviderCode } from "@/lib/payments/types";
import {
  applyProviderStatus,
  errorCode,
  scopeClause,
  writeReconciliationIssue,
  type JobScope,
  type JobServiceDeps,
} from "./job-deps";

// Job expiry (F-18, AC-18.1): payment pending lewat expires_at + 5 menit → Get Status Midtrans →
// applyVerifiedStatus (paid tetap diproses sebagai paid, source `expiry_job`); masih pending →
// expirePayment ke provider lalu status provider terbaru diterapkan. Tidak pernah menandai paid
// tanpa konfirmasi provider (BR-18).

export const EXPIRE_BATCH_SIZE = 50;
export const EXPIRE_GRACE_MINUTES = 5;
/** Transaksi pending tanpa payment aktif lebih lama dari ini dipulihkan (P11). */
export const ORPHAN_PENDING_TX_MINUTES = 30;

interface Candidate {
  [k: string]: unknown;
  id: string;
  provider_ref: string | null;
  code: ProviderCode;
}

/** M3: lebih dari ini 404 → anggap gangguan Midtrans (bukan order hilang). */
export const NOT_FOUND_STORM_TOTAL = 10;
export const NOT_FOUND_STORM_MIN_BATCH = 5;

export interface ExpireSummary {
  [k: string]: unknown;
  checked: number;
  expired: number;
  paid: number;
  otherApplied: number;
  stillPending: number;
  missingAtProvider: number;
  notFoundHeld: number;
  notFoundStorm: boolean;
  errors: number;
  batches: number;
  hasMore: boolean;
  healedTransactions: number;
}

/**
 * Satu batch: yang belum dicek pada run ini (`last_checked_at` < awal run), urut
 * `last_checked_at NULLS FIRST, expires_at, id` — payment yang terus gagal tidak menahan yang lain
 * (M2). `last_checked_at` diperbarui pada setiap percobaan, jadi tidak butuh cursor.
 */
export async function selectExpiredBatch(
  runStart: string,
  limit: number,
  scope?: JobScope,
): Promise<Candidate[]> {
  const r = await getDb().execute<Candidate>(sql`
    SELECT p.id, p.provider_ref, pp.code
    FROM payments p
    JOIN payment_providers pp ON pp.id = p.provider_id
    JOIN transactions t ON t.id = p.transaction_id
    WHERE p.status = 'pending'
      AND p.expires_at < now() - make_interval(mins => ${EXPIRE_GRACE_MINUTES})
      AND (p.last_checked_at IS NULL OR p.last_checked_at < ${runStart}::timestamptz)
      ${scopeClause(sql`t.campaign_id`, scope)}
    ORDER BY p.last_checked_at NULLS FIRST, p.expires_at, p.id
    LIMIT ${limit}`);
  return r.rows;
}

async function touch(id: string): Promise<void> {
  await getDb().execute(
    sql`UPDATE payments SET last_checked_at = now() WHERE id = ${id}::uuid AND status = 'pending'`,
  );
}

export async function runExpirePayments(
  deps: JobServiceDeps,
  opts: { deadline: number; batchSize?: number; scope?: JobScope },
): Promise<ExpireSummary> {
  const now = deps.now ?? Date.now;
  const batchSize = opts.batchSize ?? EXPIRE_BATCH_SIZE;
  const s: ExpireSummary = {
    checked: 0,
    expired: 0,
    paid: 0,
    otherApplied: 0,
    stillPending: 0,
    missingAtProvider: 0,
    notFoundHeld: 0,
    notFoundStorm: false,
    errors: 0,
    batches: 0,
    hasMore: false,
    healedTransactions: 0,
  };
  if (now() >= opts.deadline) return { ...s, hasMore: true };
  const runStart = (await getDb().execute<{ ts: string }>(sql`SELECT now()::text AS ts`)).rows[0]!
    .ts;

  let notFoundTotal = 0;
  outer: for (;;) {
    if (now() >= opts.deadline) {
      s.hasMore = true;
      break;
    }
    const batch = await selectExpiredBatch(runStart, batchSize, opts.scope);
    if (batch.length === 0) break;
    s.batches += 1;
    const notFound: Candidate[] = [];
    let processed = 0;
    for (const p of batch) {
      if (now() >= opts.deadline) {
        s.hasMore = true;
        await settleNotFound(notFound, processed, notFoundTotal, deps, s);
        break outer;
      }
      s.checked += 1;
      processed += 1;
      await touch(p.id);
      if ((await expireOne(p, deps, s)) === "not_found") notFound.push(p);
    }
    notFoundTotal = await settleNotFound(notFound, processed, notFoundTotal, deps, s);
    if (batch.length < batchSize) break;
  }

  if (now() < opts.deadline) {
    s.healedTransactions = await healPendingWithoutActivePayment(opts.scope);
  }
  return s;
}

/**
 * M3 circuit breaker: 404 Get Status hanya di-expire lokal bila jarang. >50% batch (min 5)
 * atau >10 per run → `provider_404_storm`: status dibiarkan, alert, sisa run tidak lagi
 * meng-expire karena 404. Mengembalikan total 404 kumulatif.
 */
async function settleNotFound(
  list: Candidate[],
  batchLen: number,
  total: number,
  deps: JobServiceDeps,
  s: ExpireSummary,
): Promise<number> {
  const cumulative = total + list.length;
  const storm =
    s.notFoundStorm ||
    (list.length >= NOT_FOUND_STORM_MIN_BATCH && list.length * 2 > batchLen) ||
    cumulative > NOT_FOUND_STORM_TOTAL;
  if (storm) {
    if (!s.notFoundStorm) {
      deps.log.error("payment.alert", {
        kind: "provider_404_storm",
        source: "expiry_job",
        batchNotFound: list.length,
        batchSize: batchLen,
        totalNotFound: cumulative,
      });
      await deps
        .publishNotification?.(
          {
            event: "admin.alert",
            kind: "payment",
            alert: "provider_404_storm",
            ref: new Date().toISOString().slice(0, 10),
            counts: { batchNotFound: list.length, batchSize: batchLen, totalNotFound: cumulative },
          },
          deps.log,
        )
        .catch((e: unknown) => deps.log.error("publish alert 404 gagal", { error: String(e) }));
    }
    s.notFoundStorm = true;
    s.notFoundHeld += list.length;
    return cumulative;
  }
  for (const p of list) {
    // Midtrans tidak mengenal order ini → tidak mungkin dibayar. Expire lokal + catat temuan.
    await applyProviderStatus(
      {
        paymentId: p.id,
        status: "expired",
        amount: null,
        paidAt: null,
        source: "expiry_job",
        eventId: null,
      },
      deps,
    );
    await writeReconciliationIssue("payment", p.id, {
      kind: "missing_at_provider",
      dbStatus: "pending",
      action: "expired_locally",
      source: "expiry_job",
    });
    s.missingAtProvider += 1;
  }
  return cumulative;
}

async function expireOne(
  p: Candidate,
  deps: JobServiceDeps,
  s: ExpireSummary,
): Promise<"done" | "not_found"> {
  const log = deps.log.child({ paymentId: p.id });
  const provider = deps.getProvider(p.code);
  if (!provider) {
    s.errors += 1;
    log.error("expire: provider tidak terkonfigurasi", { provider: p.code });
    return "done";
  }
  const ref = { providerRef: p.provider_ref ?? "", orderId: p.id };
  try {
    let st = await provider.getPaymentStatus(ref);
    if (st.status === "pending") {
      await provider.expirePayment(ref);
      st = await provider.getPaymentStatus(ref);
      if (st.status === "pending") {
        s.stillPending += 1;
        log.warn("expire: provider masih pending setelah expire");
        return "done";
      }
    }
    const r = await applyProviderStatus(
      {
        paymentId: p.id,
        status: st.status,
        amount: st.paidAmount ?? null,
        paidAt: st.paidAt ?? null,
        source: "expiry_job",
        eventId: null,
        providerRef: st.providerRef || null,
        needsReview: st.needsReview,
      },
      deps,
    );
    tally(s, r.changed ? r.newStatus : null);
  } catch (e) {
    if (e instanceof MidtransError && e.code === "not_found") return "not_found";
    s.errors += 1;
    log.error("expire: gagal memproses payment", { error: errorCode(e) });
  }
  return "done";
}

function tally(s: ExpireSummary, status: PaymentStatus | null): void {
  if (status === "expired") s.expired += 1;
  else if (status === "paid") s.paid += 1;
  else if (status) s.otherApplied += 1;
}

/**
 * P11: transaksi `pending` tanpa payment `pending/paid` (mis. ganti metode gagal setelah payment
 * lama dibatalkan) diberi status terminal dari attempt terakhir (expired/failed/cancelled) —
 * transisi legal state machine. Dilewati bila ada payment `created` (sedang dibuat) atau
 * aktivitas payment < 30 menit. Satu statement (UPDATE + audit) agar atomik.
 */
export async function healPendingWithoutActivePayment(scope?: JobScope): Promise<number> {
  const r = await getDb().execute<{ entity_id: string }>(sql`
    WITH cand AS (
      SELECT t.id, (
        SELECT p.status FROM payments p
        WHERE p.transaction_id = t.id AND p.status IN ('expired', 'failed', 'cancelled')
        ORDER BY p.updated_at DESC, p.created_at DESC LIMIT 1
      ) AS last_status
      FROM transactions t
      WHERE t.status = 'pending'
        AND t.updated_at < now() - make_interval(mins => ${ORPHAN_PENDING_TX_MINUTES})
        AND NOT EXISTS (
          SELECT 1 FROM payments o WHERE o.transaction_id = t.id
            AND (o.status IN ('created', 'pending', 'paid')
              OR o.updated_at > now() - make_interval(mins => ${ORPHAN_PENDING_TX_MINUTES})))
        ${scopeClause(sql`t.campaign_id`, scope)}
      ORDER BY t.updated_at
      LIMIT 200
    ), upd AS (
      UPDATE transactions t SET status = cand.last_status::text::transaction_status, updated_at = now()
      FROM cand
      WHERE t.id = cand.id AND cand.last_status IS NOT NULL AND t.status = 'pending'
        AND NOT EXISTS (SELECT 1 FROM payments o WHERE o.transaction_id = t.id
          AND o.status IN ('created', 'pending', 'paid'))
      RETURNING t.id, t.status
    )
    INSERT INTO audit_logs (actor_type, action, entity_type, entity_id, metadata)
    SELECT 'system', 'transaction.status_healed', 'transaction', upd.id::text,
      jsonb_build_object('from', 'pending', 'to', upd.status::text, 'reason', 'no_active_payment')
    FROM upd
    RETURNING entity_id`);
  return r.rows.length;
}
