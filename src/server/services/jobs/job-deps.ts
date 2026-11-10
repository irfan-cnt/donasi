import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { buildAuditRow } from "@/lib/audit/audit-row";
import { getDb, getTxDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import type { Logger } from "@/lib/logger";
import {
  applyVerifiedStatus,
  type ApplyVerifiedStatusInput,
  type ApplyVerifiedStatusResult,
} from "@/lib/payments/apply-verified-status";
import type { PaymentProvider, ProviderCode } from "@/lib/payments/types";
import type { NotifyJob } from "@/lib/notifications/jobs";
import { followUpJobs } from "@/lib/payments/notification-jobs";
import type { PaidJob } from "@/lib/payments/webhook/midtrans-webhook";

// Dependensi bersama job P14. Route memakai implementasi nyata (registry, QStash, revalidateTag);
// test meng-inject provider Midtrans dengan fetch stub dan side effect palsu.

export interface AdminAlertJob {
  event: "admin.alert";
  kind: "reconciliation";
  /** Tanggal WIB (YYYY-MM-DD) — kunci dedup. */
  date: string;
  counts: Record<string, number>;
}

export interface JobServiceDeps {
  log: Logger;
  getProvider: (code: ProviderCode) => PaymentProvider | null;
  /** QStash payment.paid → /api/jobs/notify (P16). Tidak boleh mengubah status. */
  publishPaid: (job: PaidJob, log: Logger) => Promise<void>;
  revalidateCampaign: (campaignId: string, log: Logger) => Promise<void>;
  /** Alert admin (email EMAIL_ADMIN_ALERT dikirim handler notify P16). */
  publishAdminAlert: (job: AdminAlertJob, log: Logger) => Promise<void>;
  /** P16: notifikasi lain (payment.failed/expired, admin.alert anomali) setelah commit. */
  publishNotification?: (job: NotifyJob, log: Logger) => Promise<void>;
  /** revalidateTag (campaign scheduler). */
  revalidateTags: (tags: string[]) => void;
  now?: () => number;
}

/**
 * Batasi job ke campaign tertentu. HANYA untuk uji integrasi terhadap DB dev bersama (agar job
 * tidak menyentuh baris milik orang lain); route produksi tidak pernah mengisinya.
 */
export interface JobScope {
  campaignIds?: string[];
}

/** `AND <col> IN (...)` bila scope diisi; kosong bila tidak. */
export function scopeClause(column: SQL, scope?: JobScope): SQL {
  const ids = scope?.campaignIds;
  if (!ids) return sql``;
  if (ids.length === 0) return sql` AND false`;
  return sql` AND ${column} IN (${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

/** Status provider (BR-18: hanya dari getPaymentStatus) → applyVerifiedStatus + outbox, lalu efek samping. */
export async function applyProviderStatus(
  input: ApplyVerifiedStatusInput,
  deps: JobServiceDeps,
): Promise<ApplyVerifiedStatusResult> {
  const applied = await getTxDb().transaction(async (tx) => {
    const r = await applyVerifiedStatus(tx, input, deps.log);
    if (r.becamePaid && r.transactionId) {
      // Outbox sama dengan webhook (§5b 5b): penanda notifikasi di transaksi yang sama.
      await tx.insert(auditLogs).values(
        buildAuditRow({
          actor: { type: "system" },
          action: "notification.pending",
          entityType: "transaction",
          entityId: r.transactionId,
          metadata: { event: "payment.paid", paymentId: input.paymentId },
        }),
      );
    }
    return r;
  });
  if (applied.alert) {
    deps.log.error("payment.alert", {
      kind: applied.alert.kind,
      paymentId: applied.alert.paymentId,
      source: input.source,
    });
  }
  if (applied.becamePaid && applied.transactionId) {
    await deps
      .publishPaid(
        { event: "payment.paid", transactionId: applied.transactionId, paymentId: input.paymentId },
        deps.log,
      )
      .catch((e: unknown) => deps.log.error("publish payment.paid gagal", { error: String(e) }));
    if (applied.campaignId) {
      await deps
        .revalidateCampaign(applied.campaignId, deps.log)
        .catch((e: unknown) => deps.log.warn("revalidate gagal", { error: String(e) }));
    }
  }
  if (deps.publishNotification) {
    for (const job of followUpJobs(applied, input.paymentId)) {
      await deps
        .publishNotification(job, deps.log)
        .catch((e: unknown) => deps.log.error(`publish ${job.event} gagal`, { error: String(e) }));
    }
  }
  return applied;
}

const toJson = (v: unknown) =>
  JSON.parse(
    JSON.stringify(v, (_k, x: unknown) => (typeof x === "bigint" ? x.toString() : x)),
  ) as Record<string, unknown>;

/** audit_logs `reconciliation.issue` (actor system). Metadata tanpa PII. */
export async function writeReconciliationIssue(
  entityType: "payment" | "campaign" | "transaction",
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await getDb()
    .insert(auditLogs)
    .values(
      buildAuditRow({
        actor: { type: "system" },
        action: "reconciliation.issue",
        entityType,
        entityId,
        metadata: toJson(metadata),
      }),
    );
}

/** Kode error aman untuk log (tanpa body provider/PII). */
export function errorCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e && typeof e.code === "string") {
    return `${e instanceof Error ? e.name : "error"}:${e.code}`;
  }
  return e instanceof Error ? e.name : "unknown";
}
