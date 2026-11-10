import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  notificationLogs,
  notificationTemplates,
  paymentMethods,
  payments,
  platformSettings,
  transactions,
} from "@/lib/db/schema";

// Akses DB untuk handler notifikasi (P16). Tidak pernah menyentuh status payment/transaksi (BR-31).

export interface NotificationContext {
  transactionId: string;
  code: string;
  transactionStatus: string;
  amount: bigint;
  campaignTitle: string;
  donorName: string;
  donorEmail: string;
  donorPhone: string | null;
  whatsappOptIn: boolean;
  createdAt: Date;
  payment: {
    status: string;
    instruction: unknown;
    expiresAt: Date | null;
    methodName: string;
    methodInstructions: unknown;
  } | null;
}

export async function findNotificationContext(
  transactionId: string,
  paymentId: string | null,
): Promise<NotificationContext | null> {
  const [t] = await getDb()
    .select({
      transactionId: transactions.id,
      code: transactions.code,
      transactionStatus: transactions.status,
      amount: transactions.amount,
      campaignTitle: transactions.campaignTitleSnapshot,
      donorName: transactions.donorNameSnapshot,
      donorEmail: transactions.donorEmailSnapshot,
      donorPhone: transactions.donorPhoneSnapshot,
      whatsappOptIn: transactions.whatsappOptIn,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);
  if (!t) return null;
  let payment: NotificationContext["payment"] = null;
  if (paymentId) {
    const [p] = await getDb()
      .select({
        status: payments.status,
        instruction: payments.instruction,
        expiresAt: payments.expiresAt,
        methodName: paymentMethods.displayName,
        methodInstructions: paymentMethods.instructions,
      })
      .from(payments)
      .innerJoin(paymentMethods, eq(payments.paymentMethodId, paymentMethods.id))
      .where(and(eq(payments.id, paymentId), eq(payments.transactionId, transactionId)))
      .limit(1);
    payment = p ?? null;
  }
  return { ...t, amount: BigInt(t.amount), payment };
}

export async function findActiveTemplate(event: string, channel: "email" | "whatsapp") {
  const [row] = await getDb()
    .select({
      id: notificationTemplates.id,
      version: notificationTemplates.version,
      subject: notificationTemplates.subject,
      body: notificationTemplates.body,
    })
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.event, event),
        eq(notificationTemplates.channel, channel),
        eq(notificationTemplates.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findOrganizationSettings(): Promise<{ name?: string; address?: string }> {
  const rows = await getDb()
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings)
    .where(inArray(platformSettings.key, ["organization.name", "organization.address"]));
  const get = (k: string) => {
    const v = rows.find((r) => r.key === k)?.value;
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return { name: get("organization.name"), address: get("organization.address") };
}

export type LogStatus = "queued" | "sent" | "failed" | "skipped";

export interface ClaimedLog {
  id: string;
  status: LogStatus;
  attempt: number;
  /** false bila baris sudah ada sebelumnya (job ulang / retry QStash). */
  created: boolean;
}

/** Buat baris log (dedup_key unik) atau kembalikan baris yang sudah ada. */
export async function claimNotificationLog(row: {
  channel: "email" | "whatsapp";
  recipient: string;
  event: string;
  dedupKey: string;
  transactionId: string | null;
  templateId: string | null;
  templateVersion: number | null;
  requestPayload: Record<string, unknown> | null;
  status?: LogStatus;
  errorMessage?: string | null;
}): Promise<ClaimedLog> {
  const inserted = await getDb()
    .insert(notificationLogs)
    .values({ ...row, status: row.status ?? "queued" })
    .onConflictDoNothing({ target: notificationLogs.dedupKey })
    .returning({ id: notificationLogs.id, status: notificationLogs.status, attempt: notificationLogs.attempt });
  if (inserted[0]) return { ...inserted[0], created: true };
  const [existing] = await getDb()
    .select({ id: notificationLogs.id, status: notificationLogs.status, attempt: notificationLogs.attempt })
    .from(notificationLogs)
    .where(eq(notificationLogs.dedupKey, row.dedupKey))
    .limit(1);
  if (!existing) throw new Error("notification_logs: baris dedup tidak ditemukan");
  return { ...existing, created: false };
}

export async function updateNotificationLog(
  id: string,
  patch: {
    status: LogStatus;
    attempt?: number;
    providerResponse?: Record<string, unknown> | null;
    errorMessage?: string | null;
    sent?: boolean;
    requestPayload?: Record<string, unknown> | null;
    templateId?: string | null;
    templateVersion?: number | null;
  },
): Promise<void> {
  const { sent, ...rest } = patch;
  await getDb()
    .update(notificationLogs)
    .set({ ...rest, ...(sent ? { sentAt: sql`now()` } : {}) })
    .where(eq(notificationLogs.id, id));
}

/** platform_settings `notifications.whatsapp_enabled` (P17). Hanya nilai boolean `true` yang mengaktifkan. */
export async function findWhatsappEnabledSetting(): Promise<boolean> {
  const [row] = await getDb()
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, "notifications.whatsapp_enabled"))
    .limit(1);
  return row?.value === true;
}
