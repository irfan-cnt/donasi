import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { writeAudit } from "@/lib/audit";
import { buildAuditRow } from "@/lib/audit/audit-row";
import { getTxDb } from "@/lib/db";
import { auditLogs, paymentMethods } from "@/lib/db/schema";
import { maskEmail, maskPhone } from "@/lib/format/mask";
import { logger } from "@/lib/logger";
import { safeError } from "@/lib/jobs/job-route";
import { MidtransError } from "@/lib/payments/midtrans/errors";
import type { PaymentProvider, ProviderCode } from "@/lib/payments/types";
import { acquireLock, rateLimit, releaseLock } from "@/lib/redis";
import { isManagedImageUrl } from "@/lib/storage/image-storage";
import { paymentMethodInputSchema, reorderSchema } from "@/lib/validation/admin-finance";
import {
  findCheckablePayments,
  type AdminDonorRow,
  type AdminTransactionRow,
} from "@/server/repositories/admin-finance-repository";
import { invalidatePaymentMethodsCache } from "./payment-service";
import { applyProviderStatus, type JobServiceDeps } from "./jobs/job-deps";
import { AdminForbiddenError, type AdminActor, type FieldErrors, type MutationResult } from "./admin-campaign-service";

// Admin keuangan (P22; F-26, F-27, BR-18, BR-19, BR-41). Tidak ada fungsi yang menulis status
// `paid`: satu-satunya jalur perubahan status adalah `applyProviderStatus` → applyVerifiedStatus
// dengan hasil `getPaymentStatus()` provider (source `admin_check`).

function assertPerm(actor: AdminActor, perm: Parameters<typeof hasPermission>[1]): void {
  if (!hasPermission(actor.permissions, perm)) throw new AdminForbiddenError(perm);
}

/** Admin boleh melihat email/WA penuh hanya dengan donors.export (F-28). */
export const canSeeDonorPii = (permissions: readonly string[]) => hasPermission(permissions, "donors.export");

export function maskTransactionRow<T extends Pick<AdminTransactionRow, "donorEmail" | "donorPhone">>(row: T, mask: boolean): T {
  if (!mask) return row;
  return { ...row, donorEmail: maskEmail(row.donorEmail), donorPhone: row.donorPhone ? maskPhone(row.donorPhone) : null };
}

export function maskDonorRow<T extends Pick<AdminDonorRow, "email" | "phone">>(row: T, mask: boolean): T {
  if (!mask) return row;
  return { ...row, email: maskEmail(row.email), phone: row.phone ? maskPhone(row.phone) : null };
}

const plain = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) out[issue.path.map(String).join(".") || "form"] ??= issue.message;
  return out;
}

// ---------------------------------------------------------------- Metode pembayaran

export async function savePaymentMethod(actor: AdminActor, id: string, raw: unknown): Promise<MutationResult> {
  assertPerm(actor, "payment_methods.write");
  const parsed = paymentMethodInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian yang ditandai.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const v = parsed.data;
  const result = await getTxDb().transaction(async (tx) => {
    const [cur] = await tx.select().from(paymentMethods).where(eq(paymentMethods.id, id)).for("update");
    if (!cur) return { ok: false as const, error: "Metode pembayaran tidak ditemukan." };
    const logoUrl = v.logoUrl ? v.logoUrl : null;
    if (logoUrl && !isManagedImageUrl(logoUrl, cur.logoUrl ? [cur.logoUrl] : [])) {
      return { ok: false as const, error: "Logo harus diunggah lewat tombol unggah.", fieldErrors: { logoUrl: "Logo tidak valid" } };
    }
    const next = {
      displayName: v.displayName,
      logoUrl,
      isActive: v.isActive,
      minAmount: v.minAmount,
      maxAmount: v.maxAmount,
      expiryMinutes: v.expiryMinutes,
      feeFlat: v.feeFlat,
      feePercent: Number(v.feePercent).toFixed(2),
      // OD-04: biaya selalu ditanggung lembaga; opsi donatur menanggung biaya tidak dibangun.
      feeBorneBy: "platform" as const,
      instructions: v.instructions,
    };
    const before = {
      displayName: cur.displayName,
      logoUrl: cur.logoUrl,
      isActive: cur.isActive,
      minAmount: cur.minAmount,
      maxAmount: cur.maxAmount,
      expiryMinutes: cur.expiryMinutes,
      feeFlat: cur.feeFlat,
      feePercent: cur.feePercent,
      feeBorneBy: cur.feeBorneBy,
      instructions: cur.instructions,
    };
    await tx.update(paymentMethods).set({ ...next, updatedAt: new Date() }).where(eq(paymentMethods.id, id));
    await tx.insert(auditLogs).values(
      buildAuditRow({
        actor: { type: "admin", id: actor.adminId },
        action: "payment_method.update",
        entityType: "payment_method",
        entityId: id,
        before: plain(before),
        after: plain(next),
        metadata: { code: cur.code },
        ip: actor.ip,
        ua: actor.ua,
      }),
    );
    return { ok: true as const };
  });
  if (result.ok) await invalidatePaymentMethodsCache();
  return result;
}

export async function reorderPaymentMethods(actor: AdminActor, raw: unknown): Promise<MutationResult> {
  assertPerm(actor, "payment_methods.write");
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Urutan tidak valid." };
  const ids = parsed.data;
  const result = await getTxDb().transaction(async (tx) => {
    const all = await tx
      .select({ id: paymentMethods.id, code: paymentMethods.code, order: paymentMethods.displayOrder })
      .from(paymentMethods)
      .for("update");
    if (all.length !== ids.length || !all.every((m) => ids.includes(m.id))) {
      return { ok: false as const, error: "Daftar metode berubah. Muat ulang halaman lalu coba lagi." };
    }
    const byId = new Map(all.map((m) => [m.id, m]));
    const beforeOrder = [...all].sort((a, b) => a.order - b.order || a.code.localeCompare(b.code)).map((m) => m.code);
    for (const [i, mid] of ids.entries()) {
      await tx.update(paymentMethods).set({ displayOrder: (i + 1) * 10, updatedAt: new Date() }).where(eq(paymentMethods.id, mid));
    }
    await tx.insert(auditLogs).values(
      buildAuditRow({
        actor: { type: "admin", id: actor.adminId },
        action: "payment_method.reorder",
        entityType: "payment_method",
        entityId: null,
        before: { order: beforeOrder },
        after: { order: ids.map((mid) => byId.get(mid)!.code) },
        ip: actor.ip,
        ua: actor.ua,
      }),
    );
    return { ok: true as const };
  });
  if (result.ok) await invalidatePaymentMethodsCache();
  return result;
}

export type ConnectionTestResult = "ok" | "invalid_credentials" | "unconfigured" | "error" | "rate_limited";

export interface ConnectionTestDeps {
  getProvider: (code: ProviderCode) => PaymentProvider | null;
}

/**
 * "Tes koneksi" (F-26): GET status untuk order fiktif (UUID acak). 404 = kredensial diterima,
 * 401/403 = kredensial ditolak. Tidak ada kredensial di respons/log/audit. Rate limit 5/10 menit
 * per admin; diaudit.
 */
export async function testProviderConnection(
  actor: AdminActor,
  deps: ConnectionTestDeps,
): Promise<{ result: ConnectionTestResult; detail?: string }> {
  assertPerm(actor, "payment_methods.write");
  const limit = await rateLimit("admin-provider-test", actor.adminId, 5, "10 m");
  if (!limit.success) return { result: "rate_limited" };
  const provider = deps.getProvider("midtrans");
  let result: ConnectionTestResult;
  let detail: string | undefined;
  if (!provider) {
    result = "unconfigured";
  } else {
    try {
      await provider.getPaymentStatus({ providerRef: "", orderId: randomUUID() });
      result = "ok"; // tidak lazim (order fiktif ditemukan) — tetap berarti auth diterima
    } catch (error) {
      if (error instanceof MidtransError && error.code === "not_found") result = "ok";
      else if (error instanceof MidtransError && error.code === "unauthorized") result = "invalid_credentials";
      else {
        result = "error";
        detail = error instanceof MidtransError ? error.code : "unknown";
      }
    }
  }
  await writeAudit({
    actor: { type: "admin", id: actor.adminId },
    action: "payment_provider.connection_test",
    entityType: "payment_provider",
    entityId: "midtrans",
    metadata: { result, ...(detail ? { detail } : {}) },
    ip: actor.ip,
    ua: actor.ua,
  });
  return { result, detail };
}

// ---------------------------------------------------------------- Cek status manual

export interface StatusCheckItem {
  paymentId: string;
  providerStatus: string | null;
  outcome: string;
}

/**
 * "Cek status ke Midtrans" (F-27, permission transactions.reconcile): Get Status SEGAR ke provider
 * lalu applyVerifiedStatus (source `admin_check`) — status apa pun yang ditulis berasal dari
 * provider, bukan dari admin (BR-18). Lock per transaksi mencegah klik ganda; rate limit per admin.
 */
export async function checkTransactionStatus(
  actor: AdminActor,
  transactionId: string,
  deps: JobServiceDeps,
): Promise<MutationResult<{ items: StatusCheckItem[]; message: string }>> {
  assertPerm(actor, "transactions.reconcile");
  const limit = await rateLimit("admin-status-check", actor.adminId, 20, "10 m");
  if (!limit.success) return { ok: false, error: "Terlalu banyak pengecekan. Coba lagi beberapa menit lagi." };
  const lockName = `admin-status-check:${transactionId}`;
  const owner = await acquireLock(lockName, 30_000);
  if (!owner) return { ok: false, error: "Pengecekan untuk transaksi ini sedang berjalan." };
  try {
    const pays = await findCheckablePayments(transactionId);
    if (pays.length === 0) return { ok: false, error: "Transaksi belum memiliki percobaan pembayaran." };
    const items: StatusCheckItem[] = [];
    for (const p of pays) {
      const provider = deps.getProvider(p.providerCode as ProviderCode);
      if (!provider) {
        items.push({ paymentId: p.id, providerStatus: null, outcome: "provider_unconfigured" });
        continue;
      }
      try {
        const st = await provider.getPaymentStatus({ providerRef: p.providerRef ?? "", orderId: p.id });
        const r = await applyProviderStatus(
          {
            paymentId: p.id,
            status: st.status,
            amount: st.paidAmount ?? null,
            paidAt: st.paidAt ?? null,
            source: "admin_check",
            eventId: null,
            providerRef: st.providerRef || null,
            needsReview: st.needsReview,
          },
          deps,
        );
        items.push({ paymentId: p.id, providerStatus: st.status, outcome: r.changed ? `changed:${r.newStatus}` : r.outcome });
      } catch (error) {
        const code = error instanceof MidtransError ? error.code : "error";
        if (!(error instanceof MidtransError)) logger.error("cek status admin gagal", { paymentId: p.id, error: safeError(error) });
        items.push({ paymentId: p.id, providerStatus: null, outcome: code });
      }
    }
    await writeAudit({
      actor: { type: "admin", id: actor.adminId },
      action: "transaction.status_check",
      entityType: "transaction",
      entityId: transactionId,
      metadata: { items: items.map((i) => ({ ...i })) },
      ip: actor.ip,
      ua: actor.ua,
    });
    const changed = items.filter((i) => i.outcome.startsWith("changed:"));
    const message = changed.length
      ? `Status diperbarui dari Midtrans: ${changed.map((c) => c.outcome.slice(8)).join(", ")}.`
      : items.every((i) => i.providerStatus === null)
        ? "Midtrans tidak dapat dihubungi atau transaksi tidak ditemukan di Midtrans. Tidak ada perubahan."
        : "Status sudah sesuai dengan Midtrans. Tidak ada perubahan.";
    return { ok: true, items, message };
  } finally {
    await releaseLock(lockName, owner).catch(() => undefined);
  }
}
