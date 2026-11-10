"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestMeta, requireAdmin, type AdminContext } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import { safeError } from "@/lib/jobs/job-route";
import { getProvider } from "@/lib/payments/registry";
import { AdminForbiddenError, type AdminActor, type MutationResult } from "@/server/services/admin-campaign-service";
import {
  checkTransactionStatus,
  reorderPaymentMethods,
  savePaymentMethod,
  testProviderConnection,
  type ConnectionTestResult,
  type StatusCheckItem,
} from "@/server/services/admin-finance-service";
import { runtimeJobDeps } from "@/server/services/jobs/runtime-deps";

// Server action admin keuangan (P22). Setiap action: requireAdmin(permission BR-40) → service
// (cek permission lagi + Zod + audit). TIDAK ADA action yang menandai transaksi lunas (AC-27.1).

const idSchema = z.uuid();
const badId = { ok: false as const, error: "Data tidak valid." };

async function actorOf(ctx: AdminContext): Promise<AdminActor> {
  const meta = await getRequestMeta();
  return { adminId: ctx.adminId, permissions: ctx.permissions, ip: meta.ip, ua: meta.ua };
}

async function run<T extends object>(fn: () => Promise<MutationResult<T>>): Promise<MutationResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AdminForbiddenError) return { ok: false, error: "Anda tidak punya izin untuk aksi ini." };
    logger.error("admin keuangan: aksi gagal", { error: safeError(error) });
    return { ok: false, error: "Terjadi kesalahan. Silakan coba lagi." };
  }
}

export async function savePaymentMethodAction(id: string, values: unknown): Promise<MutationResult> {
  const ctx = await requireAdmin("payment_methods.write");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  const res = await run(() => savePaymentMethod(actor, id, values));
  if (res.ok) revalidatePath("/admin/metode-pembayaran");
  return res;
}

export async function reorderPaymentMethodsAction(ids: unknown): Promise<MutationResult> {
  const ctx = await requireAdmin("payment_methods.write");
  const actor = await actorOf(ctx);
  const res = await run(() => reorderPaymentMethods(actor, ids));
  if (res.ok) revalidatePath("/admin/metode-pembayaran");
  return res;
}

export async function testProviderConnectionAction(): Promise<{ result: ConnectionTestResult; detail?: string }> {
  const ctx = await requireAdmin("payment_methods.write");
  const actor = await actorOf(ctx);
  try {
    return await testProviderConnection(actor, { getProvider: (code) => getProvider(code) });
  } catch (error) {
    logger.error("tes koneksi provider gagal", { error: safeError(error) });
    return { result: "error" };
  }
}

export async function checkTransactionStatusAction(
  transactionId: string,
): Promise<MutationResult<{ items: StatusCheckItem[]; message: string }>> {
  const ctx = await requireAdmin("transactions.reconcile");
  if (!idSchema.safeParse(transactionId).success) return badId;
  const actor = await actorOf(ctx);
  const res = await run(() => checkTransactionStatus(actor, transactionId, runtimeJobDeps(logger.child({ admin: "status-check" }))));
  if (res.ok) revalidatePath(`/admin/transaksi/${transactionId}`);
  return res;
}
