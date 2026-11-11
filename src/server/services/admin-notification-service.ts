import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { hasPermission, type Permission } from "@/lib/admin-auth/permissions";
import { writeAudit } from "@/lib/audit";
import { buildAuditRow } from "@/lib/audit/audit-row";
import { getDb, getTxDb } from "@/lib/db";
import { auditLogs, notificationLogs, notificationTemplates } from "@/lib/db/schema";
import type { EmailQuotaCounter, EmailSender } from "@/lib/email/gmail";
import { maskEmail, maskPhone, maskPiiDeep, maskPiiText } from "@/lib/format/mask";
import { newId } from "@/lib/id";
import { safeError } from "@/lib/jobs/job-route";
import { logger } from "@/lib/logger";
import { renderEmailLayout } from "@/lib/notifications/email-layout";
import {
  FINANCIAL_EVENTS,
  RESENDABLE_EVENTS,
  resendDedupKey,
  type ResendJob,
} from "@/lib/notifications/jobs";
import {
  redactTokens,
  renderSubject,
  renderTemplate,
  SAMPLE_VARS,
  validateTemplate,
  validateTemplateFields,
} from "@/lib/notifications/template";
import { rateLimit } from "@/lib/redis";
import { SITE_NAME } from "@/lib/site";
import { resendInputSchema, templateInputSchema } from "@/lib/validation/admin-notifications";
import {
  findAdminContact,
  findTemplate,
  type AdminNotificationLogRow,
} from "@/server/repositories/admin-notification-repository";
import {
  findLogById,
  findNotificationContext,
  findOrganizationSettings,
  hasQueuedResend,
  hasSentLog,
  hasSentLogTx,
  lockNotificationKey,
  notificationLockKey,
} from "@/server/repositories/notification-repository";
import { AdminForbiddenError, type AdminActor, type FieldErrors, type MutationResult } from "./admin-campaign-service";
import { isAnonymizedRecipient, jakartaDay, resolveResendPaymentId, safeErrorCode } from "./notification-service";

// Admin notifikasi (P23; F-20, F-21, BR-30, BR-32). Template: whitelist variabel dicek saat simpan,
// aktivasi, kirim tes, dan lagi saat render di handler. Kirim tes hanya ke email admin yang login
// (dibaca dari DB, tidak pernah dari klien). Kirim ulang membuat baris log baru lalu diproses
// lewat antrean notifikasi yang sama (consent/flag/kuota/flow control tetap berlaku).

function assertPerm(actor: AdminActor, perm: Permission): void {
  if (!hasPermission(actor.permissions, perm)) throw new AdminForbiddenError(perm);
}

/** Admin boleh melihat penerima penuh hanya dengan donors.export (OD-21, sama dengan P22). */
export const canSeeRecipient = (permissions: readonly string[]) => hasPermission(permissions, "donors.export");

export function maskRecipient(channel: "email" | "whatsapp", recipient: string, mask: boolean): string {
  if (!mask || recipient === "-") return recipient;
  return channel === "email" ? maskEmail(recipient) : maskPhone(recipient);
}

export function maskLogRow<T extends Pick<AdminNotificationLogRow, "channel" | "recipient" | "errorMessage">>(
  row: T,
  mask: boolean,
): T {
  if (!mask) return row;
  return {
    ...row,
    recipient: maskRecipient(row.channel, row.recipient, true),
    errorMessage: row.errorMessage ? maskPiiText(row.errorMessage) : null,
  };
}

const SECRET_KEY = /token|secret|password|authorization|api[_-]?key|cookie|signature/i;

/**
 * Respons provider untuk ditampilkan: kunci rahasia → [REDACTED], token di URL → ***, email/nomor
 * → dimasking (untuk SEMUA admin; respons provider tidak butuh PII penuh). Data tersimpan tidak diubah.
 */
export function redactProviderResponse(value: unknown): unknown {
  const walk = (v: unknown, depth: number): unknown => {
    if (depth > 6) return "[…]";
    if (typeof v === "string") return maskPiiText(redactTokens(v)).slice(0, 2000);
    // L4: nomor WA bisa dikembalikan provider sebagai angka JSON (mis. target 628123…).
    if (typeof v === "number" || typeof v === "bigint") {
      const text = String(v);
      const masked = maskPiiText(text);
      return masked === text ? v : masked;
    }
    if (Array.isArray(v)) return v.slice(0, 50).map((x) => walk(x, depth + 1));
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, SECRET_KEY.test(k) ? "[REDACTED]" : walk(x, depth + 1)]),
      );
    }
    return v;
  };
  return maskPiiDeep(walk(value, 0));
}

function templateErrors(input: { channel: "email" | "whatsapp"; subject: string | null; body: string }): FieldErrors | null {
  const v = validateTemplateFields(input);
  if (v.ok) return null;
  const out: FieldErrors = {};
  if (v.subject.length) out.subject = v.subject.join("; ");
  if (v.body.length) out.body = v.body.join("; ");
  return out;
}

// ---------------------------------------------------------------- Template

export async function saveTemplate(
  actor: AdminActor,
  id: string,
  raw: unknown,
): Promise<MutationResult<{ version: number }>> {
  assertPerm(actor, "notifications.write");
  const parsed = templateInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.map(String).join(".") || "form"] ??= i.message;
    return { ok: false, error: "Periksa kembali isian yang ditandai.", fieldErrors };
  }
  const v = parsed.data;
  return getTxDb().transaction(async (tx) => {
    const [cur] = await tx.select().from(notificationTemplates).where(eq(notificationTemplates.id, id)).for("update");
    if (!cur) return { ok: false as const, error: "Template tidak ditemukan." };
    if (cur.version !== v.version) {
      return { ok: false as const, error: `Template sudah diubah admin lain (versi ${cur.version}). Muat ulang halaman.` };
    }
    const subject = cur.channel === "email" ? (v.subject ?? "") : null;
    const errors = templateErrors({ channel: cur.channel, subject, body: v.body });
    if (errors) return { ok: false as const, error: "Template tidak dapat disimpan.", fieldErrors: errors };
    const next = { name: v.name, subject, body: v.body, version: cur.version + 1 };
    await tx
      .update(notificationTemplates)
      .set({ ...next, updatedBy: actor.adminId, updatedAt: new Date() })
      .where(eq(notificationTemplates.id, id));
    await tx.insert(auditLogs).values(
      buildAuditRow({
        actor: { type: "admin", id: actor.adminId },
        action: "notification_template.update",
        entityType: "notification_template",
        entityId: id,
        before: { name: cur.name, subject: cur.subject, body: cur.body, version: cur.version },
        after: next,
        metadata: { event: cur.event, channel: cur.channel },
        ip: actor.ip,
        ua: actor.ua,
      }),
    );
    return { ok: true as const, version: next.version };
  });
}

/** Aktifkan satu template; template lain di (event, kanal) yang sama dinonaktifkan dalam transaksi yang sama (BR-30). */
export async function activateTemplate(actor: AdminActor, id: string): Promise<MutationResult> {
  assertPerm(actor, "notifications.write");
  return getTxDb().transaction(async (tx) => {
    const [cur] = await tx.select().from(notificationTemplates).where(eq(notificationTemplates.id, id)).for("update");
    if (!cur) return { ok: false as const, error: "Template tidak ditemukan." };
    if (cur.isActive) return { ok: true as const };
    if (!validateTemplate({ channel: cur.channel, subject: cur.subject, body: cur.body }).ok) {
      return { ok: false as const, error: "Template berisi variabel/format tidak valid; perbaiki sebelum diaktifkan." };
    }
    const sameKey = and(eq(notificationTemplates.event, cur.event), eq(notificationTemplates.channel, cur.channel));
    const others = await tx
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(and(sameKey, eq(notificationTemplates.isActive, true), ne(notificationTemplates.id, id)))
      .for("update");
    // Nonaktifkan dulu (partial unique index aktif per event+kanal), lalu aktifkan.
    await tx
      .update(notificationTemplates)
      .set({ isActive: false, updatedBy: actor.adminId, updatedAt: new Date() })
      .where(and(sameKey, eq(notificationTemplates.isActive, true)));
    await tx
      .update(notificationTemplates)
      .set({ isActive: true, updatedBy: actor.adminId, updatedAt: new Date() })
      .where(eq(notificationTemplates.id, id));
    await tx.insert(auditLogs).values(
      buildAuditRow({
        actor: { type: "admin", id: actor.adminId },
        action: "notification_template.activate",
        entityType: "notification_template",
        entityId: id,
        before: { isActive: false },
        after: { isActive: true },
        metadata: { event: cur.event, channel: cur.channel, deactivated: others.map((o) => o.id) },
        ip: actor.ip,
        ua: actor.ua,
      }),
    );
    return { ok: true as const };
  });
}

/** Salin template sebagai draf nonaktif (versi 1) untuk disunting lalu diaktifkan. */
export async function duplicateTemplate(actor: AdminActor, id: string): Promise<MutationResult<{ id: string }>> {
  assertPerm(actor, "notifications.write");
  const src = await findTemplate(id);
  if (!src) return { ok: false, error: "Template tidak ditemukan." };
  const copyId = newId();
  const name = `Salinan ${src.name}`.slice(0, 100);
  await getTxDb().transaction(async (tx) => {
    await tx.insert(notificationTemplates).values({
      id: copyId,
      event: src.event,
      channel: src.channel,
      name,
      subject: src.subject,
      body: src.body,
      isActive: false,
      version: 1,
      updatedBy: actor.adminId,
    });
    await tx.insert(auditLogs).values(
      buildAuditRow({
        actor: { type: "admin", id: actor.adminId },
        action: "notification_template.create",
        entityType: "notification_template",
        entityId: copyId,
        after: { name, event: src.event, channel: src.channel },
        metadata: { copiedFrom: id },
        ip: actor.ip,
        ua: actor.ua,
      }),
    );
  });
  return { ok: true, id: copyId };
}

// ---------------------------------------------------------------- Kirim tes

export interface TestSendDeps {
  sender: EmailSender;
  quota: EmailQuotaCounter;
  config: { enabled: boolean; dailyLimit: number; siteUrl: string };
  now?: () => Date;
}

export const TEST_SEND_LIMIT = { limit: 5, window: "10 m" } as const;
export const RESEND_LIMIT = { limit: 20, window: "10 m" } as const;
/** L2: kirim ulang paksa per (transaksi, event, kanal) — maksimal 3 per 24 jam (sliding window). */
export const FORCED_RESEND_LIMIT = { limit: 3, window: "1 d" } as const;
const NEEDS_FORCE = "Notifikasi finansial ini sudah terkirim. Untuk mengirim lagi, gunakan “Kirim ulang paksa” dengan alasan.";

/**
 * Kirim tes (AC-20.3): penerima = email admin yang login, dibaca dari DB lewat `actor.adminId`
 * (tidak ada parameter penerima). WhatsApp: admin_users tidak menyimpan nomor → ditolak. Baris log
 * `is_test = true`, tanpa transaksi & tanpa dedup_key (tidak memengaruhi dedup donatur).
 */
export async function sendTestNotification(
  actor: AdminActor,
  templateId: string,
  deps: TestSendDeps,
): Promise<MutationResult<{ status: "sent" | "skipped" | "failed"; message: string }>> {
  assertPerm(actor, "notifications.write");
  const template = await findTemplate(templateId);
  if (!template) return { ok: false, error: "Template tidak ditemukan." };
  if (template.channel === "whatsapp") {
    return {
      ok: false,
      error: "Akun admin belum memiliki nomor WhatsApp terdaftar, jadi kirim tes WhatsApp tidak tersedia. Gunakan pratinjau.",
    };
  }
  if (!validateTemplate({ channel: template.channel, subject: template.subject, body: template.body }).ok) {
    return { ok: false, error: "Template tersimpan tidak valid; perbaiki sebelum kirim tes." };
  }
  const limited = await rateLimit("admin-notif-test", actor.adminId, TEST_SEND_LIMIT.limit, TEST_SEND_LIMIT.window);
  if (!limited.success) return { ok: false, error: "Terlalu banyak kirim tes. Coba lagi dalam beberapa menit." };
  const admin = await findAdminContact(actor.adminId);
  if (!admin) return { ok: false, error: "Akun admin tidak aktif." };

  const site = deps.config.siteUrl;
  const vars = { ...SAMPLE_VARS, payment_url: `${site}/transaksi/${SAMPLE_VARS.transaction_id}/menunggu` };
  const logId = newId();
  const skipped = deps.config.enabled ? null : "NOTIFICATIONS_ENABLED=false";
  await getDb()
    .insert(notificationLogs)
    .values({
      id: logId,
      channel: "email",
      recipient: admin.email,
      event: template.event,
      templateId: template.id,
      templateVersion: template.version,
      transactionId: null,
      dedupKey: null,
      requestPayload: { test: true, sample: true },
      status: skipped ? "skipped" : "queued",
      errorMessage: skipped,
      isTest: true,
    });

  let status: "sent" | "skipped" | "failed" = "skipped";
  let errorCode: string | null = skipped;
  if (!skipped) {
    const count = await deps.quota.increment(jakartaDay((deps.now ?? (() => new Date()))()));
    if (count > deps.config.dailyLimit) {
      status = "failed";
      errorCode = "kuota email harian terlampaui (EMAIL_DAILY_LIMIT)";
      await getDb().update(notificationLogs).set({ status, errorMessage: errorCode, attempt: 1 }).where(eq(notificationLogs.id, logId));
    } else {
      try {
        const subject = `[TES] ${renderSubject(template.subject ?? "", vars)}`.slice(0, 200);
        const body = renderTemplate(template.body, vars);
        const org = await findOrganizationSettings();
        const layout = renderEmailLayout({
          subject,
          body,
          org: { name: org.name ?? SITE_NAME, address: org.address ?? "", siteUrl: site },
          footerNote: "Email uji dari panel admin dengan data contoh — bukan transaksi nyata.",
        });
        const res = await deps.sender.send({ to: admin.email, subject, ...layout });
        status = "sent";
        errorCode = null;
        await getDb()
          .update(notificationLogs)
          .set({ status, attempt: 1, sentAt: new Date(), providerResponse: { ...res }, errorMessage: null })
          .where(eq(notificationLogs.id, logId));
      } catch (e) {
        status = "failed";
        errorCode = safeErrorCode(e);
        await getDb().update(notificationLogs).set({ status, attempt: 1, errorMessage: errorCode }).where(eq(notificationLogs.id, logId));
      }
    }
  }
  await writeAudit({
    actor: { type: "admin", id: actor.adminId },
    action: "notification_template.test_send",
    entityType: "notification_template",
    entityId: template.id,
    metadata: { channel: "email", status, logId, version: template.version },
    ip: actor.ip,
    ua: actor.ua,
  });
  const message =
    status === "sent"
      ? `Email tes terkirim ke ${maskEmail(admin.email)}.`
      : status === "skipped"
        ? "Pengiriman dinonaktifkan (NOTIFICATIONS_ENABLED=false); tes dicatat sebagai skipped."
        : `Kirim tes gagal (${errorCode}).`;
  return { ok: true, status, message };
}

// ---------------------------------------------------------------- Kirim ulang

export interface ResendDeps {
  publish: (job: ResendJob, channel: "email" | "whatsapp") => Promise<void>;
}

/**
 * Kirim ulang (F-21): baris log BARU (`queued`, dedup_key `resend:{asal}:{baru}`) + audit dalam satu
 * transaksi, lalu job `notification.resend` diantrekan. Event finansial yang sudah `sent` ditolak
 * kecuali paksa (butuh `transactions.reconcile` + alasan). Consent WA tidak pernah dilewati.
 */
export async function resendNotification(
  actor: AdminActor,
  raw: unknown,
  deps: ResendDeps,
): Promise<MutationResult<{ logId: string; message: string }> & { needsForce?: boolean }> {
  assertPerm(actor, "notifications.write");
  const parsed = resendInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Data tidak valid.", fieldErrors: issue?.path[0] === "reason" ? { reason: issue.message } : undefined };
  }
  const { logId, force, reason } = parsed.data;
  if (force) assertPerm(actor, "transactions.reconcile");

  const original = await findLogById(logId);
  if (!original) return { ok: false, error: "Log notifikasi tidak ditemukan." };
  if (original.isTest) return { ok: false, error: "Log kirim tes tidak dapat dikirim ulang." };
  if (!original.transactionId || !(RESENDABLE_EVENTS as readonly string[]).includes(original.event)) {
    return { ok: false, error: "Notifikasi jenis ini tidak dapat dikirim ulang." };
  }
  const ctx = await findNotificationContext(original.transactionId, null);
  if (!ctx) return { ok: false, error: "Transaksi tidak ditemukan." };
  if (original.channel === "whatsapp" && !ctx.whatsappOptIn) {
    return { ok: false, error: "Donatur tidak memberi persetujuan WhatsApp pada transaksi ini, jadi tidak dapat dikirim ulang." };
  }
  if (isAnonymizedRecipient(ctx.donorEmail)) {
    return { ok: false, error: "Data donatur transaksi ini sudah dianonimkan (penghapusan akun), jadi notifikasi tidak dapat dikirim ulang." };
  }
  const financial = (FINANCIAL_EVENTS as readonly string[]).includes(original.event);
  if (financial && !force && (await hasSentLog(original.transactionId, original.event, original.channel))) {
    return { ok: false, needsForce: true, error: NEEDS_FORCE };
  }
  const limited = await rateLimit("admin-notif-resend", actor.adminId, RESEND_LIMIT.limit, RESEND_LIMIT.window);
  if (!limited.success) return { ok: false, error: "Terlalu banyak kirim ulang. Coba lagi dalam beberapa menit." };
  if (force) {
    // L2: batas per (transaksi, event, kanal), terpisah dari batas per admin.
    const perTarget = await rateLimit(
      "admin-notif-resend-forced",
      `${original.transactionId}:${original.event}:${original.channel}`,
      FORCED_RESEND_LIMIT.limit,
      FORCED_RESEND_LIMIT.window,
    );
    if (!perTarget.success) {
      return { ok: false, error: `Batas kirim ulang paksa untuk notifikasi ini tercapai (${FORCED_RESEND_LIMIT.limit}× per 24 jam).` };
    }
  }

  const prevMeta = (original.requestPayload ?? {}) as Record<string, unknown>;
  const paymentId =
    original.dedupKey?.startsWith("resend:") && typeof prevMeta.payment_id === "string"
      ? prevMeta.payment_id
      : await resolveResendPaymentId({ event: original.event, dedupKey: original.dedupKey, transactionId: original.transactionId });
  const newLogId = newId();
  const recipient = original.channel === "email" ? ctx.donorEmail : (ctx.donorPhone ?? "-");
  const trxId = original.transactionId;
  // M1: cek + insert diserialkan per (transaksi, event, kanal) — kunci yang sama dengan handler job.
  const refused = await getTxDb().transaction(async (tx) => {
    await lockNotificationKey(tx, notificationLockKey(trxId, original.event, original.channel));
    if (!force) {
      if (financial && (await hasSentLogTx(tx, trxId, original.event, original.channel))) {
        return { ok: false as const, needsForce: true, error: NEEDS_FORCE };
      }
      if (await hasQueuedResend(tx, trxId, original.event, original.channel)) {
        return { ok: false as const, error: "Kirim ulang untuk notifikasi ini masih dalam antrean. Tunggu hingga statusnya berubah." };
      }
    }
    await tx.insert(notificationLogs).values({
      id: newLogId,
      channel: original.channel,
      recipient,
      event: original.event,
      transactionId: trxId,
      dedupKey: resendDedupKey(original.id, newLogId),
      requestPayload: { resend_of: original.id, forced: force, payment_id: paymentId },
      status: "queued",
      isTest: false,
    });
    await tx.insert(auditLogs).values(
      buildAuditRow({
        actor: { type: "admin", id: actor.adminId },
        action: force ? "notification.resend_forced" : "notification.resend",
        entityType: "notification_log",
        entityId: newLogId,
        metadata: {
          originalLogId: original.id,
          transactionId: trxId,
          event: original.event,
          channel: original.channel,
          forced: force,
          // Alasan bebas: email/nomor di dalamnya disamarkan sebelum disimpan.
          reason: force ? maskPiiText(reason) : null,
        },
        ip: actor.ip,
        ua: actor.ua,
      }),
    );
    return null;
  });
  if (refused) return refused;
  try {
    await deps.publish({ event: "notification.resend", logId: newLogId }, original.channel);
  } catch (e) {
    logger.error("kirim ulang: gagal mengantre", { error: safeError(e) });
    await getDb()
      .update(notificationLogs)
      .set({ status: "failed", errorMessage: "gagal diantrekan (QStash)" })
      .where(eq(notificationLogs.id, newLogId));
    return { ok: false, error: "Kirim ulang tercatat tetapi gagal diantrekan. Coba lagi nanti." };
  }
  return { ok: true, logId: newLogId, message: "Kirim ulang diantrekan. Status akan diperbarui di log." };
}
