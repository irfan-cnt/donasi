import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { NOTIFICATION_PAGE_SIZE, type NotificationLogQuery } from "@/lib/validation/admin-notifications";
import { escapeLike, phoneQuery } from "./admin-finance-repository";

// Query admin notifikasi (P23; F-20, F-21). Parameterised `sql`, LIKE di-escape, paginasi dikunci.
// Penerima dikembalikan MENTAH — masking dilakukan service sebelum ke UI. `exactPii = true` (admin
// tanpa donors.export) → pencarian penerima hanya nilai persis (anti-oracle, sama dengan P22).

type Row = Record<string, unknown>;
async function rows(query: SQL): Promise<Row[]> {
  return (await getDb().execute(query)).rows as Row[];
}
const toDate = (v: unknown) => (v === null || v === undefined ? null : new Date(String(v)));
const TRX_CODE = /^TK-[0-9A-Z-]{1,16}$/i;

export interface AdminTemplateRow {
  id: string;
  event: string;
  channel: "email" | "whatsapp";
  name: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  version: number;
  updatedAt: Date;
  updatedByName: string | null;
}

const templateSelect = sql`SELECT nt.id, nt.event, nt.channel, nt.name, nt.subject, nt.body, nt.is_active, nt.version,
  nt.updated_at, au.name AS updated_by_name
  FROM notification_templates nt LEFT JOIN admin_users au ON au.id = nt.updated_by`;

const mapTemplate = (r: Row): AdminTemplateRow => ({
  id: String(r.id),
  event: String(r.event),
  channel: r.channel as AdminTemplateRow["channel"],
  name: String(r.name),
  subject: (r.subject as string | null) ?? null,
  body: String(r.body),
  isActive: r.is_active === true,
  version: Number(r.version),
  updatedAt: toDate(r.updated_at)!,
  updatedByName: (r.updated_by_name as string | null) ?? null,
});

export async function listTemplates(channel?: "email" | "whatsapp"): Promise<AdminTemplateRow[]> {
  const where = channel ? sql`WHERE nt.channel = ${channel}` : sql``;
  return (await rows(sql`${templateSelect} ${where} ORDER BY nt.event, nt.is_active DESC, nt.name LIMIT 200`)).map(mapTemplate);
}

export async function findTemplate(id: string): Promise<AdminTemplateRow | null> {
  const [r] = await rows(sql`${templateSelect} WHERE nt.id = ${id}::uuid`);
  return r ? mapTemplate(r) : null;
}

export async function findAdminContact(adminId: string): Promise<{ email: string } | null> {
  const [r] = await rows(sql`SELECT email FROM admin_users WHERE id = ${adminId}::uuid AND status = 'active'`);
  return r ? { email: String(r.email) } : null;
}

// ---------------------------------------------------------------- Log

export interface AdminNotificationLogRow {
  id: string;
  channel: "email" | "whatsapp";
  recipient: string;
  event: string;
  status: "queued" | "sent" | "failed" | "skipped";
  templateId: string | null;
  templateName: string | null;
  templateVersion: number | null;
  transactionId: string | null;
  transactionCode: string | null;
  errorMessage: string | null;
  attempt: number;
  isTest: boolean;
  isResend: boolean;
  createdAt: Date;
  sentAt: Date | null;
}

const logSelect = sql`SELECT n.id, n.channel, n.recipient, n.event, n.status, n.template_id, nt.name AS template_name,
  n.template_version, n.transaction_id, t.code AS transaction_code, n.error_message, n.attempt, n.is_test,
  (n.dedup_key LIKE 'resend:%') AS is_resend, n.created_at, n.sent_at
  FROM notification_logs n
  LEFT JOIN notification_templates nt ON nt.id = n.template_id
  LEFT JOIN transactions t ON t.id = n.transaction_id`;

const mapLog = (r: Row): AdminNotificationLogRow => ({
  id: String(r.id),
  channel: r.channel as AdminNotificationLogRow["channel"],
  recipient: String(r.recipient),
  event: String(r.event),
  status: r.status as AdminNotificationLogRow["status"],
  templateId: (r.template_id as string | null) ?? null,
  templateName: (r.template_name as string | null) ?? null,
  templateVersion: r.template_version === null || r.template_version === undefined ? null : Number(r.template_version),
  transactionId: (r.transaction_id as string | null) ?? null,
  transactionCode: (r.transaction_code as string | null) ?? null,
  errorMessage: (r.error_message as string | null) ?? null,
  attempt: Number(r.attempt ?? 0),
  isTest: r.is_test === true,
  isResend: r.is_resend === true,
  createdAt: toDate(r.created_at)!,
  sentAt: toDate(r.sent_at),
});

export function logWhere(q: Omit<NotificationLogQuery, "hal" | "id">, exactPii: boolean): SQL {
  const w: SQL[] = [];
  if (q.kanal) w.push(sql`n.channel = ${q.kanal}`);
  if (q.status) w.push(sql`n.status = ${q.status}`);
  if (q.template) w.push(sql`n.template_id = ${q.template}::uuid`);
  if (q.q) {
    const s = q.q;
    const or: SQL[] = [];
    if (TRX_CODE.test(s)) or.push(sql`t.code LIKE ${`${escapeLike(s.toUpperCase())}%`}`);
    if (s.includes("@")) {
      or.push(exactPii ? sql`lower(n.recipient) = lower(${s})` : sql`n.recipient ILIKE ${`%${escapeLike(s)}%`}`);
    }
    const phone = phoneQuery(s);
    if (phone) {
      // Penerima WA tersimpan sebagai snapshot (E.164 atau 08…): cocokkan kedua bentuk.
      const local = `0${phone.slice(3)}`;
      or.push(
        exactPii
          ? sql`n.recipient IN (${phone}, ${local})`
          : sql`n.recipient LIKE ${`%${escapeLike(phone.slice(3))}%`}`,
      );
    }
    w.push(or.length ? sql`(${sql.join(or, sql` OR `)})` : sql`false`);
  }
  return w.length ? sql.join(w, sql` AND `) : sql`true`;
}

export async function listNotificationLogs(
  q: NotificationLogQuery,
  exactPii: boolean,
): Promise<{ rows: AdminNotificationLogRow[]; total: number }> {
  const where = logWhere(q, exactPii);
  const [list, totals] = await Promise.all([
    rows(sql`${logSelect} WHERE ${where} ORDER BY n.created_at DESC, n.id DESC
      LIMIT ${NOTIFICATION_PAGE_SIZE} OFFSET ${(q.hal - 1) * NOTIFICATION_PAGE_SIZE}`),
    rows(sql`SELECT count(*)::int AS n FROM notification_logs n
      LEFT JOIN transactions t ON t.id = n.transaction_id WHERE ${where}`),
  ]);
  return { rows: list.map(mapLog), total: Number(totals[0]?.n ?? 0) };
}

export async function findNotificationLog(
  id: string,
): Promise<(AdminNotificationLogRow & { providerResponse: unknown; dedupKey: string | null; requestPayload: unknown }) | null> {
  const [r] = await rows(sql`SELECT x.*, n.provider_response, n.dedup_key, n.request_payload
    FROM (${logSelect} WHERE n.id = ${id}::uuid) x JOIN notification_logs n ON n.id = x.id`);
  return r
    ? {
        ...mapLog(r),
        providerResponse: r.provider_response ?? null,
        dedupKey: (r.dedup_key as string | null) ?? null,
        requestPayload: r.request_payload ?? null,
      }
    : null;
}

export async function listTemplateOptions(): Promise<{ id: string; name: string; channel: string }[]> {
  return (await rows(sql`SELECT id, name, channel FROM notification_templates ORDER BY channel, name LIMIT 200`)).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    channel: String(r.channel),
  }));
}
