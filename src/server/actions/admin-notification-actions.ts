"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestMeta, requireAdmin, type AdminContext } from "@/lib/admin-auth";
import { createGmailSender, createRedisQuotaCounter } from "@/lib/email/gmail";
import { safeError } from "@/lib/jobs/job-route";
import { logger } from "@/lib/logger";
import { AdminForbiddenError, type AdminActor, type MutationResult } from "@/server/services/admin-campaign-service";
import {
  activateTemplate,
  duplicateTemplate,
  resendNotification,
  saveTemplate,
  sendTestNotification,
} from "@/server/services/admin-notification-service";
import { runtimeNotifyConfig } from "@/server/services/notifications/notify-handler";
import { publishResendJob } from "@/server/services/notifications/publish";

// Server action admin notifikasi (P23). Setiap action: requireAdmin(notifications.write) → service
// (cek permission lagi + Zod + audit). Kirim ulang paksa butuh juga transactions.reconcile.

const idSchema = z.uuid();
const badId = { ok: false as const, error: "Data tidak valid." };
const TEMPLATE_PATH = "/admin/template-notifikasi";
const LOG_PATH = "/admin/log-notifikasi";

async function actorOf(ctx: AdminContext): Promise<AdminActor> {
  const meta = await getRequestMeta();
  return { adminId: ctx.adminId, permissions: ctx.permissions, ip: meta.ip, ua: meta.ua };
}

async function run<T extends object>(fn: () => Promise<MutationResult<T>>): Promise<MutationResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AdminForbiddenError) return { ok: false, error: "Anda tidak punya izin untuk aksi ini." };
    logger.error("admin notifikasi: aksi gagal", { error: safeError(error) });
    return { ok: false, error: "Terjadi kesalahan. Silakan coba lagi." };
  }
}

export async function saveTemplateAction(id: string, values: unknown): Promise<MutationResult<{ version: number }>> {
  const ctx = await requireAdmin("notifications.write");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  const res = await run(() => saveTemplate(actor, id, values));
  if (res.ok) revalidatePath(TEMPLATE_PATH);
  return res;
}

export async function activateTemplateAction(id: string): Promise<MutationResult> {
  const ctx = await requireAdmin("notifications.write");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  const res = await run(() => activateTemplate(actor, id));
  if (res.ok) revalidatePath(TEMPLATE_PATH);
  return res;
}

export async function duplicateTemplateAction(id: string): Promise<MutationResult<{ id: string }>> {
  const ctx = await requireAdmin("notifications.write");
  if (!idSchema.safeParse(id).success) return badId;
  const actor = await actorOf(ctx);
  const res = await run(() => duplicateTemplate(actor, id));
  if (res.ok) revalidatePath(TEMPLATE_PATH);
  return res;
}

/** Kirim tes: hanya id template — penerima diambil server dari akun admin yang login. */
export async function sendTestNotificationAction(
  templateId: string,
): Promise<MutationResult<{ status: "sent" | "skipped" | "failed"; message: string }>> {
  const ctx = await requireAdmin("notifications.write");
  if (!idSchema.safeParse(templateId).success) return badId;
  const actor = await actorOf(ctx);
  const config = runtimeNotifyConfig();
  return run(() =>
    sendTestNotification(actor, templateId, {
      sender: createGmailSender(),
      quota: createRedisQuotaCounter(),
      config: { enabled: config.enabled, dailyLimit: config.dailyLimit, siteUrl: config.siteUrl },
    }),
  );
}

export async function resendNotificationAction(
  input: unknown,
): Promise<MutationResult<{ logId: string; message: string }> & { needsForce?: boolean }> {
  const ctx = await requireAdmin("notifications.write");
  const actor = await actorOf(ctx);
  const res = await run(() => resendNotification(actor, input, { publish: publishResendJob }));
  if (res.ok) revalidatePath(LOG_PATH);
  return res;
}
