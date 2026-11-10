import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { MidtransError } from "@/lib/payments/midtrans/errors";
import type { PaymentStatus, ProviderCode, StatusResult } from "@/lib/payments/types";
import {
  applyProviderStatus,
  errorCode,
  scopeClause,
  writeReconciliationIssue,
  type JobScope,
  type JobServiceDeps,
} from "./job-deps";

// Rekonsiliasi harian 01:00 WIB (F-18, AC-18.2, §6). Membandingkan payment dengan Get Status
// Midtrans; perubahan status HANYA lewat applyVerifiedStatus (source `reconcile`, BR-18/19).
// Selisih → audit `reconciliation.issue` + alert admin (dikirim P16). Total campaign hanya
// DILAPORKAN, tidak pernah diperbaiki otomatis.

export const RECONCILE_WINDOW_HOURS = 48;
/** Payment `created` lebih muda dari ini dianggap sedang dibuat (dilewati). */
export const IN_FLIGHT_MINUTES = 30;
export const RECONCILE_MAX_PAYMENTS = 1000;
/** Audit orphan_charge diperiksa lebih lama dari jendela utama (charge bisa hidup s/d 7 hari). */
export const ORPHAN_LOOKBACK_DAYS = 7;
export const OUTBOX_LOOKBACK_DAYS = 7;
export const OUTBOX_MIN_AGE_MINUTES = 10;
export const OUTBOX_DRAIN_LIMIT = 100;
/** M5: waktu yang disisakan untuk total campaign, outbox & alert setelah loop payment. */
export const POST_LOOP_RESERVE_MS = 15_000;

const TERMINAL: readonly PaymentStatus[] = ["expired", "failed", "cancelled"];

interface PaymentRow {
  [k: string]: unknown;
  id: string;
  status: PaymentStatus;
  amount: string;
  provider_ref: string | null;
  code: ProviderCode;
}

export interface ReconcileSummary {
  [k: string]: unknown;
  checked: number;
  ok: number;
  applied: number;
  issues: number;
  errors: number;
  truncated: boolean;
  fromOrphanAudits: number;
  fromWebhookAnomalies: number;
  campaignMismatches: number;
  outboxUndrained: number;
  outboxRepublished: number;
  alertPublished: boolean;
}

/** Kandidat: payment 48 jam + audit orphan_charge + event webhook rejected/error/unverifiable. */
export async function selectReconcileCandidates(scope?: JobScope) {
  // L1: payment `created` < 30 menit sedang dibuat → dilewati di SEMUA sumber kandidat.
  const notInFlight = sql` AND NOT (p.status = 'created' AND p.created_at > now() - make_interval(mins => ${IN_FLIGHT_MINUTES}))`;
  const sc = sql`${scopeClause(sql`t.campaign_id`, scope)}${notInFlight}`;
  const recent = await getDb().execute<{ id: string }>(sql`
    SELECT p.id FROM payments p JOIN transactions t ON t.id = p.transaction_id
    WHERE (p.created_at > now() - make_interval(hours => ${RECONCILE_WINDOW_HOURS})
        OR p.updated_at > now() - make_interval(hours => ${RECONCILE_WINDOW_HOURS}))
      ${sc}
    ORDER BY p.created_at
    LIMIT ${RECONCILE_MAX_PAYMENTS + 1}`);
  const orphans = await getDb().execute<{ id: string }>(sql`
    SELECT DISTINCT p.id FROM audit_logs a
    JOIN payments p ON p.id::text = a.entity_id
    JOIN transactions t ON t.id = p.transaction_id
    WHERE a.action = 'payment.orphan_charge'
      AND a.created_at > now() - make_interval(days => ${ORPHAN_LOOKBACK_DAYS})${sc}`);
  // Event webhook ditolak/error dan audit webhook_unverifiable (entity = payment_events.id).
  const anomalies = await getDb().execute<{ id: string }>(sql`
    SELECT DISTINCT p.id FROM payment_events e
    JOIN payments p ON p.id = e.payment_id
      OR (e.payment_id IS NULL AND p.id::text = e.payload->>'order_id')
    JOIN transactions t ON t.id = p.transaction_id
    WHERE e.received_at > now() - make_interval(hours => ${RECONCILE_WINDOW_HOURS})
      AND e.event_type = 'notification'
      AND (e.verification = 'rejected' OR e.result = 'error'
        OR EXISTS (SELECT 1 FROM audit_logs a WHERE a.action = 'payment.webhook_unverifiable'
          AND a.entity_id = e.id::text))
      ${sc}`);
  return { recent: recent.rows, orphans: orphans.rows, anomalies: anomalies.rows };
}

async function loadPayment(id: string): Promise<PaymentRow | null> {
  const r = await getDb().execute<PaymentRow>(sql`
    SELECT p.id, p.status, p.amount::text AS amount, p.provider_ref, pp.code
    FROM payments p JOIN payment_providers pp ON pp.id = p.provider_id
    WHERE p.id = ${id}::uuid`);
  return r.rows[0] ?? null;
}

export async function runReconcile(
  deps: JobServiceDeps,
  opts: { deadline: number; scope?: JobScope; date: string },
): Promise<ReconcileSummary> {
  const now = deps.now ?? Date.now;
  const s: ReconcileSummary = {
    checked: 0,
    ok: 0,
    applied: 0,
    issues: 0,
    errors: 0,
    truncated: false,
    fromOrphanAudits: 0,
    fromWebhookAnomalies: 0,
    campaignMismatches: 0,
    outboxUndrained: 0,
    outboxRepublished: 0,
    alertPublished: false,
  };

  const c = await selectReconcileCandidates(opts.scope);
  if (c.recent.length > RECONCILE_MAX_PAYMENTS) {
    s.truncated = true;
    c.recent.pop();
  }
  s.fromOrphanAudits = c.orphans.length;
  s.fromWebhookAnomalies = c.anomalies.length;
  const ids = [...new Set([...c.orphans, ...c.anomalies, ...c.recent].map((r) => r.id))];

  const loopDeadline = opts.deadline - POST_LOOP_RESERVE_MS;
  for (const id of ids) {
    if (now() >= loopDeadline) {
      s.truncated = true;
      break;
    }
    const p = await loadPayment(id);
    if (!p) continue;
    s.checked += 1;
    await reconcileOne(p, deps, s);
  }

  s.campaignMismatches = await checkCampaignTotals(opts.scope);
  s.issues += s.campaignMismatches;

  const outbox = await drainNotificationOutbox(deps, opts.scope);
  s.outboxUndrained = outbox.undrained;
  s.outboxRepublished = outbox.republished;

  if (s.issues > 0 || s.errors > 0 || s.truncated) {
    try {
      await deps.publishAdminAlert(
        {
          event: "admin.alert",
          kind: "reconciliation",
          date: opts.date,
          counts: {
            issues: s.issues,
            errors: s.errors,
            campaignMismatches: s.campaignMismatches,
            truncated: s.truncated ? 1 : 0,
          },
        },
        deps.log,
      );
      s.alertPublished = true;
    } catch (e) {
      deps.log.error("reconcile: publish alert admin gagal", { error: errorCode(e) });
    }
  }
  return s;
}

async function issue(
  s: ReconcileSummary,
  p: PaymentRow,
  kind: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  s.issues += 1;
  await writeReconciliationIssue("payment", p.id, {
    kind,
    dbStatus: p.status,
    expectedAmount: p.amount,
    source: "reconcile",
    ...extra,
  });
}

async function reconcileOne(p: PaymentRow, deps: JobServiceDeps, s: ReconcileSummary) {
  const log = deps.log.child({ paymentId: p.id });
  const provider = deps.getProvider(p.code);
  if (!provider) {
    s.errors += 1;
    log.error("reconcile: provider tidak terkonfigurasi", { provider: p.code });
    return;
  }
  const ref = { providerRef: p.provider_ref ?? "", orderId: p.id };
  let st: StatusResult;
  try {
    st = await provider.getPaymentStatus(ref);
  } catch (e) {
    if (e instanceof MidtransError && e.code === "not_found") {
      if (p.status === "pending" || p.status === "paid") {
        await issue(s, p, "missing_at_provider", { action: "none" });
      } else if (p.status === "created") {
        // Charge tidak pernah dibuat (proses terhenti sebelum charge) → attempt gagal.
        // Bukan status bayar; transaksi tidak disentuh (donatur tetap bisa mencoba lagi).
        await getDb().execute(sql`
          UPDATE payments SET status = 'failed', failure_reason = 'reconcile:not_found_at_provider',
            last_checked_at = now(), updated_at = now()
          WHERE id = ${p.id}::uuid AND status = 'created'`);
        s.applied += 1;
      } else {
        s.ok += 1;
      }
      return;
    }
    s.errors += 1;
    log.error("reconcile: Get Status gagal", { error: errorCode(e) });
    return;
  }

  const expected = BigInt(p.amount);
  const reported = st.paidAmount ?? null;
  const amountDiff = reported !== null && reported !== expected;
  const extra = { providerStatus: st.status, reportedAmount: reported };

  try {
    if (p.status === st.status && !amountDiff) {
      s.ok += 1;
      return;
    }
    if (p.status === "pending") {
      if (st.status === "pending" && !amountDiff) {
        s.ok += 1;
        return;
      }
      // AC-18.2: paid di provider, pending di DB → diproses jadi paid + dicatat.
      const r = await apply(p, st, deps);
      if (r.changed) s.applied += 1;
      if (st.status === "paid" || amountDiff || r.alert) {
        await issue(s, p, amountDiff ? "amount_mismatch" : "provider_paid_db_pending", {
          ...extra,
          action: r.outcome,
          alert: r.alert?.kind ?? null,
        });
      }
      return;
    }
    if (TERMINAL.includes(p.status)) {
      if (st.status === "pending") {
        // Charge masih hidup untuk attempt yang sudah ditutup (orphan / expire gagal): matikan.
        let action = "expired_at_provider";
        try {
          await provider.expirePayment(ref);
          const after = await provider.getPaymentStatus(ref);
          if (after.status === "paid") {
            const r = await apply(p, after, deps); // → ignored_transition + needs_review
            action = `paid_after_terminal:${r.outcome}`;
          } else if (after.status === "pending") {
            action = "still_live";
          }
        } catch (e) {
          action = `expire_failed:${errorCode(e)}`;
        }
        await issue(s, p, "live_charge_on_closed_payment", { ...extra, action });
        return;
      }
      if (st.status === "paid") {
        const r = await apply(p, st, deps); // applyVerifiedStatus mencatat needs_review + alert
        await issue(s, p, "paid_after_terminal", {
          ...extra,
          action: r.outcome,
          alert: r.alert?.kind ?? null,
        });
        return;
      }
      // Status terminal berbeda (mis. failed vs expired) / nominal beda: catat saja.
      if (amountDiff) await issue(s, p, "amount_mismatch", { ...extra, action: "none" });
      else s.ok += 1;
      return;
    }
    if (p.status === "paid") {
      await issue(s, p, amountDiff ? "amount_mismatch" : "paid_status_mismatch", {
        ...extra,
        action: "none",
      });
      return;
    }
    if (p.status === "created") {
      // Payment macet di `created` tetapi Midtrans punya transaksinya.
      let action = "none";
      if (st.status === "pending") {
        action = await provider.expirePayment(ref).then(
          () => "expired_at_provider",
          (e: unknown) => `expire_failed:${errorCode(e)}`,
        );
      }
      await issue(s, p, "stuck_created_with_provider_charge", { ...extra, action });
      return;
    }
    // refunded atau kombinasi lain → catat untuk review manual.
    await issue(s, p, "status_mismatch", { ...extra, action: "none" });
  } catch (e) {
    s.errors += 1;
    log.error("reconcile: gagal memproses payment", { error: errorCode(e) });
  }
}

function apply(p: PaymentRow, st: StatusResult, deps: JobServiceDeps) {
  return applyProviderStatus(
    {
      paymentId: p.id,
      status: st.status,
      amount: st.paidAmount ?? null,
      paidAt: st.paidAt ?? null,
      source: "reconcile",
      eventId: null,
      providerRef: st.providerRef || null,
      needsReview: st.needsReview,
    },
    deps,
  );
}

/**
 * collected_amount/donor_count = SUM/COUNT transaksi paid per campaign. Selisih hanya dicatat
 * (audit `reconciliation.issue`, entity campaign) — TIDAK diperbaiki otomatis.
 */
export async function checkCampaignTotals(scope?: JobScope): Promise<number> {
  const r = await getDb().execute<{
    id: string;
    collected: string;
    donor_count: number;
    paid_sum: string;
    paid_count: number;
  }>(sql`
    SELECT c.id, c.collected_amount::text AS collected, c.donor_count,
      COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'paid'), 0)::text AS paid_sum,
      (COUNT(t.id) FILTER (WHERE t.status = 'paid'))::int AS paid_count
    FROM campaigns c LEFT JOIN transactions t ON t.campaign_id = c.id
    WHERE true ${scopeClause(sql`c.id`, scope)}
    GROUP BY c.id
    HAVING c.collected_amount <> COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'paid'), 0)
      OR c.donor_count <> COUNT(t.id) FILTER (WHERE t.status = 'paid')`);
  for (const row of r.rows) {
    await writeReconciliationIssue("campaign", row.id, {
      kind: "campaign_total_mismatch",
      collectedAmount: row.collected,
      paidSum: row.paid_sum,
      donorCount: row.donor_count,
      paidCount: row.paid_count,
      diff: (BigInt(row.collected) - BigInt(row.paid_sum)).toString(),
      action: "report_only",
    });
  }
  return r.rows.length;
}

/**
 * Outbox §5b: penanda `notification.pending` (≥10 menit) yang belum punya notification_logs
 * per kanal yang diharapkan (`email` selalu; `whatsapp` bila donatur opt-in) → publish ulang
 * payment.paid ke /api/jobs/notify. Dedup: QStash `payment-paid-{trx}` + P16
 * `notification_logs.dedup_key` (payment.paid:{trx}:{channel}). Asumsi P16: setiap kanal yang
 * diharapkan selalu mendapat baris log (termasuk `skipped`). Sampai P16 ada, /api/jobs/notify
 * membalas 404 (QStash retry lalu DLQ) — penanda tetap terlapor setiap hari.
 * Tanpa QStash (dev) hanya dihitung.
 */
export async function drainNotificationOutbox(deps: JobServiceDeps, scope?: JobScope) {
  const r = await getDb().execute<{
    trx: string;
    payment_id: string | null;
    missing: string[];
  }>(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (a.entity_id) a.entity_id AS trx, a.metadata->>'paymentId' AS payment_id,
        ARRAY(
          SELECT ch FROM unnest(CASE WHEN t.whatsapp_opt_in THEN ARRAY['email', 'whatsapp']
            ELSE ARRAY['email'] END) AS ch
          WHERE NOT EXISTS (SELECT 1 FROM notification_logs n
            WHERE n.dedup_key = 'payment.paid:' || a.entity_id || ':' || ch)
        ) AS missing
      FROM audit_logs a
      JOIN transactions t ON t.id::text = a.entity_id
      WHERE a.action = 'notification.pending'
        AND a.created_at > now() - make_interval(days => ${OUTBOX_LOOKBACK_DAYS})
        AND a.created_at < now() - make_interval(mins => ${OUTBOX_MIN_AGE_MINUTES})
        AND t.status = 'paid'
        ${scopeClause(sql`t.campaign_id`, scope)}
      ORDER BY a.entity_id, a.created_at
    ) x
    WHERE cardinality(x.missing) > 0
    LIMIT ${OUTBOX_DRAIN_LIMIT}`);
  let republished = 0;
  for (const row of r.rows) {
    if (!row.payment_id) continue;
    try {
      await deps.publishPaid(
        { event: "payment.paid", transactionId: row.trx, paymentId: row.payment_id },
        deps.log,
      );
      republished += 1;
    } catch (e) {
      deps.log.error("reconcile: publish ulang payment.paid gagal", {
        transactionId: row.trx,
        missingChannels: row.missing,
        error: errorCode(e),
      });
    }
  }
  return { undrained: r.rows.length, republished };
}
