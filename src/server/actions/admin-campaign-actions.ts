"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestMeta, requireAdmin, type AdminContext } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import {
  addDisbursement,
  AdminForbiddenError,
  changeCampaignStatus,
  deleteCampaign,
  deleteDisbursement,
  deleteNews,
  saveCampaign,
  saveNews,
  unpublishNews,
  type AdminActor,
  type MutationResult,
} from "@/server/services/admin-campaign-service";

// Server action admin campaign/berita/penyaluran (P21). Setiap action: requireAdmin(permission
// BR-40) → Zod di service → audit + revalidateTag di service.

const idSchema = z.uuid();

async function actorOf(ctx: AdminContext): Promise<AdminActor> {
  const meta = await getRequestMeta();
  return { adminId: ctx.adminId, permissions: ctx.permissions, ip: meta.ip, ua: meta.ua };
}

async function run<T extends object>(fn: () => Promise<MutationResult<T>>): Promise<MutationResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AdminForbiddenError) return { ok: false, error: "Anda tidak punya izin untuk aksi ini." };
    logger.error("admin campaign: aksi gagal", { error: String(error) });
    return { ok: false, error: "Terjadi kesalahan. Silakan coba lagi." };
  }
}

const badId: { ok: false; error: string; fieldErrors?: Record<string, string> } = { ok: false, error: "Data tidak valid." };

export async function saveCampaignAction(
  id: string | null,
  values: unknown,
  publish: boolean,
): Promise<MutationResult<{ id: string; slug: string; warning?: string }>> {
  const ctx = await requireAdmin("campaigns.write");
  if (publish === true) await requireAdmin("campaigns.publish");
  if (id !== null && !idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  return run(() => saveCampaign(actor, id, values, { publish: publish === true }));
}

export async function changeCampaignStatusAction(id: string, to: unknown) {
  const ctx = await requireAdmin("campaigns.publish");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  return run(() => changeCampaignStatus(actor, id, to));
}

export async function deleteCampaignAction(id: string): Promise<MutationResult> {
  const ctx = await requireAdmin("campaigns.write");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  const res = await run(() => deleteCampaign(actor, id));
  if (res.ok) redirect("/admin/campaign?dihapus=1");
  return res;
}

export async function saveNewsAction(id: string | null, values: unknown, publish: boolean) {
  const ctx = await requireAdmin("news.write");
  if (publish === true) await requireAdmin("news.publish");
  if (id !== null && !idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  return run(() => saveNews(actor, id, values, { publish: publish === true }));
}

export async function unpublishNewsAction(id: string) {
  const ctx = await requireAdmin("news.publish");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  return run(() => unpublishNews(actor, id));
}

export async function deleteNewsAction(id: string) {
  const ctx = await requireAdmin("news.write");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  return run(() => deleteNews(actor, id));
}

export async function addDisbursementAction(values: unknown) {
  const ctx = await requireAdmin("disbursements.write");
  const actor = await actorOf(ctx);
  return run(() => addDisbursement(actor, values));
}

export async function deleteDisbursementAction(id: string) {
  const ctx = await requireAdmin("disbursements.write");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  return run(() => deleteDisbursement(actor, id));
}
