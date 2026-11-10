import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { PaymentStatus } from "@/lib/payments/types";
import {
  FINANCE_PAGE_SIZE,
  type AuditQuery,
  type DonorFilter,
  type PaymentEventQuery,
  type TransactionFilter,
} from "@/lib/validation/admin-finance";

// Query admin keuangan (P22; F-26–F-30). Semua parameter lewat placeholder `sql` (parameterised);
// pola LIKE di-escape. Nilai PII dikembalikan MENTAH — masking dilakukan service sebelum ke UI/CSV.
// Pencarian email/WA: `exactPii = true` (admin tanpa donors.export) hanya mencocokkan nilai
// persis agar pencarian tidak menjadi oracle untuk menebak nilai yang dimasking huruf demi huruf.

type Row = Record<string, unknown>;
async function rows(query: SQL): Promise<Row[]> {
  const res = await getDb().execute(query);
  return res.rows as Row[];
}

export const escapeLike = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`);
const startOf = (day: string) => sql`(${day}::date::timestamp at time zone 'Asia/Jakarta')`;
const endOf = (day: string) => sql`((${day}::date + 1)::timestamp at time zone 'Asia/Jakarta')`;
const toDate = (v: unknown) => (v === null || v === undefined ? null : new Date(String(v)));
const toBig = (v: unknown) => BigInt(String(v ?? "0"));
const and = (parts: SQL[]) => (parts.length ? sql.join(parts, sql` AND `) : sql`true`);

const TRX_CODE = /^TK-\d{6}-[0-9A-Z]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nomor WA dari kata kunci (08…, 62…, +62…) → E.164; null bila bukan nomor. */
export function phoneQuery(q: string): string | null {
  if (!/^[+\d\s-]{8,20}$/.test(q)) return null;
  const digits = q.replace(/\D/g, "");
  const local = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return local.startsWith("62") && local.length >= 10 && local.length <= 15 ? `+${local}` : null;
}

// ---------------------------------------------------------------- Transaksi

/** WHERE untuk filter transaksi (alias `t`). Dipakai daftar, hitung, dan ekspor. */
export function transactionWhere(f: TransactionFilter, exactPii: boolean): SQL {
  const w: SQL[] = [];
  if (f.status) w.push(sql`t.status = ${f.status}`);
  if (f.campaign) w.push(sql`t.campaign_id = ${f.campaign}::uuid`);
  if (f.dari) w.push(sql`t.created_at >= ${startOf(f.dari)}`);
  if (f.sampai) w.push(sql`t.created_at < ${endOf(f.sampai)}`);
  if (f.metode) {
    w.push(sql`EXISTS (SELECT 1 FROM payments p JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.transaction_id = t.id AND pm.code = ${f.metode})`);
  }
  if (f.q) {
    const q = f.q;
    const or: SQL[] = [];
    if (TRX_CODE.test(q)) or.push(sql`t.code = ${q.toUpperCase()}`);
    else if (/^TK-[0-9A-Z-]{1,16}$/i.test(q)) or.push(sql`t.code LIKE ${`${escapeLike(q.toUpperCase())}%`}`);
    or.push(sql`t.donor_name_snapshot ILIKE ${`%${escapeLike(q)}%`}`);
    if (q.includes("@")) {
      or.push(exactPii ? sql`t.donor_email_snapshot = ${q}` : sql`t.donor_email_snapshot ILIKE ${`%${escapeLike(q)}%`}`);
    }
    const phone = phoneQuery(q);
    if (phone) {
      or.push(
        exactPii
          ? sql`t.donor_phone_snapshot = ${phone}`
          : sql`t.donor_phone_snapshot LIKE ${`%${escapeLike(phone.slice(3))}%`}`,
      );
    }
    w.push(sql`(${sql.join(or, sql` OR `)})`);
  }
  return and(w);
}

export interface AdminTransactionRow {
  id: string;
  code: string;
  donorName: string;
  donorEmail: string;
  donorPhone: string | null;
  isAnonymous: boolean;
  campaignId: string;
  campaignTitle: string;
  amount: bigint;
  status: PaymentStatus;
  methodName: string | null;
  methodCode: string | null;
  providerCode: string | null;
  createdAt: Date;
  paidAt: Date | null;
  receiptNo: string | null;
}

const trxSelect = sql`SELECT t.id, t.code, t.donor_name_snapshot, t.donor_email_snapshot::text AS email,
    t.donor_phone_snapshot, t.is_anonymous, t.campaign_id, t.campaign_title_snapshot, t.amount::text AS amount,
    t.status, lp.display_name, lp.code AS method_code, lp.provider_code, t.created_at, t.paid_at, t.receipt_no
  FROM transactions t
  LEFT JOIN LATERAL (
    SELECT pm.display_name, pm.code, pp.code AS provider_code FROM payments p
    JOIN payment_methods pm ON pm.id = p.payment_method_id
    JOIN payment_providers pp ON pp.id = p.provider_id
    WHERE p.transaction_id = t.id ORDER BY p.created_at DESC LIMIT 1
  ) lp ON true`;

function mapTrx(r: Row): AdminTransactionRow {
  return {
    id: String(r.id),
    code: String(r.code),
    donorName: String(r.donor_name_snapshot),
    donorEmail: String(r.email),
    donorPhone: (r.donor_phone_snapshot as string | null) ?? null,
    isAnonymous: Boolean(r.is_anonymous),
    campaignId: String(r.campaign_id),
    campaignTitle: String(r.campaign_title_snapshot),
    amount: toBig(r.amount),
    status: r.status as PaymentStatus,
    methodName: (r.display_name as string | null) ?? null,
    methodCode: (r.method_code as string | null) ?? null,
    providerCode: (r.provider_code as string | null) ?? null,
    createdAt: new Date(String(r.created_at)),
    paidAt: toDate(r.paid_at),
    receiptNo: (r.receipt_no as string | null) ?? null,
  };
}

export async function listAdminTransactions(
  f: TransactionFilter,
  page: number,
  exactPii: boolean,
): Promise<{ rows: AdminTransactionRow[]; total: number }> {
  const where = transactionWhere(f, exactPii);
  const [list, totals] = await Promise.all([
    rows(sql`${trxSelect} WHERE ${where} ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${FINANCE_PAGE_SIZE} OFFSET ${(page - 1) * FINANCE_PAGE_SIZE}`),
    rows(sql`SELECT count(*)::int AS n FROM transactions t WHERE ${where}`),
  ]);
  return { rows: list.map(mapTrx), total: Number(totals[0]?.n ?? 0) };
}

export async function countAdminTransactions(f: TransactionFilter, exactPii: boolean): Promise<number> {
  const r = await rows(sql`SELECT count(*)::int AS n FROM transactions t WHERE ${transactionWhere(f, exactPii)}`);
  return Number(r[0]?.n ?? 0);
}

/** Batch keyset (created_at, id) untuk ekspor streaming. */
export async function transactionExportBatch(
  f: TransactionFilter,
  exactPii: boolean,
  after: { createdAt: string; id: string } | null,
  limit: number,
): Promise<{ rows: AdminTransactionRow[]; cursor: { createdAt: string; id: string } | null }> {
  const keyset = after ? sql` AND (t.created_at, t.id) < (${after.createdAt}::timestamptz, ${after.id}::uuid)` : sql``;
  const list = await rows(sql`${trxSelect} WHERE ${transactionWhere(f, exactPii)}${keyset}
    ORDER BY t.created_at DESC, t.id DESC LIMIT ${limit}`);
  const last = list.at(-1);
  return {
    rows: list.map(mapTrx),
    cursor: last && list.length === limit ? { createdAt: String(last.created_at), id: String(last.id) } : null,
  };
}

export interface TransactionSummary {
  paidTodayAmount: bigint;
  paidTodayCount: number;
  pendingCount: number;
  pendingAmount: bigint;
  expired7d: number;
  review7d: number;
}

/** Kartu ringkasan (global, tidak mengikuti filter). Hari = kalender Asia/Jakarta. */
export async function getTransactionSummary(today: string): Promise<TransactionSummary> {
  const [paid, pending, expired, review] = await Promise.all([
    rows(sql`SELECT coalesce(sum(amount), 0)::text AS amount, count(*)::int AS n FROM transactions
      WHERE status = 'paid' AND paid_at >= ${startOf(today)} AND paid_at < ${endOf(today)}`),
    rows(sql`SELECT coalesce(sum(amount), 0)::text AS amount, count(*)::int AS n FROM transactions
      WHERE status IN ('created', 'pending')`),
    rows(sql`SELECT count(*)::int AS n FROM transactions
      WHERE status = 'expired' AND updated_at >= ${startOf(today)} - interval '6 days'`),
    rows(sql`SELECT count(*)::int AS n FROM audit_logs
      WHERE action IN ('payment.needs_review', 'payment.amount_mismatch', 'payment.unknown_payment', 'reconciliation.issue')
        AND created_at >= ${startOf(today)} - interval '6 days'`),
  ]);
  return {
    paidTodayAmount: toBig(paid[0]?.amount),
    paidTodayCount: Number(paid[0]?.n ?? 0),
    pendingAmount: toBig(pending[0]?.amount),
    pendingCount: Number(pending[0]?.n ?? 0),
    expired7d: Number(expired[0]?.n ?? 0),
    review7d: Number(review[0]?.n ?? 0),
  };
}

export async function listMethodOptions(): Promise<{ code: string; name: string }[]> {
  const r = await rows(sql`SELECT code, display_name FROM payment_methods ORDER BY display_order, code`);
  return r.map((x) => ({ code: String(x.code), name: String(x.display_name) }));
}

export interface TransactionDetail extends AdminTransactionRow {
  donorId: string;
  campaignSlug: string;
  prayer: string | null;
  whatsappOptIn: boolean;
  source: unknown;
  receiptIssuedAt: Date | null;
  donor: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    hasAccount: boolean;
    anonymizedAt: Date | null;
  };
  payments: {
    id: string;
    methodName: string;
    providerCode: string;
    providerRef: string | null;
    amount: bigint;
    feeAmount: bigint;
    status: PaymentStatus;
    expiresAt: Date | null;
    paidAt: Date | null;
    failureReason: string | null;
    lastCheckedAt: Date | null;
    createdAt: Date;
  }[];
  events: AdminPaymentEventRow[];
  notifications: {
    id: string;
    channel: string;
    event: string;
    status: string;
    recipient: string;
    createdAt: Date;
    sentAt: Date | null;
  }[];
}

export async function findTransactionDetail(id: string): Promise<TransactionDetail | null> {
  const [base] = await rows(sql`${trxSelect} WHERE t.id = ${id}::uuid`);
  if (!base) return null;
  const [extra, pays, notifs] = await Promise.all([
    rows(sql`SELECT t.donor_id, c.slug, t.prayer, t.whatsapp_opt_in, t.source, t.receipt_issued_at,
        d.name AS d_name, d.email::text AS d_email, d.phone_e164 AS d_phone, d.user_id, d.anonymized_at
      FROM transactions t JOIN campaigns c ON c.id = t.campaign_id JOIN donors d ON d.id = t.donor_id
      WHERE t.id = ${id}::uuid`),
    rows(sql`SELECT p.id, pm.display_name, pp.code AS provider_code, p.provider_ref, p.amount::text AS amount,
        p.fee_amount::text AS fee, p.status, p.expires_at, p.paid_at, p.failure_reason, p.last_checked_at, p.created_at
      FROM payments p JOIN payment_methods pm ON pm.id = p.payment_method_id
      JOIN payment_providers pp ON pp.id = p.provider_id
      WHERE p.transaction_id = ${id}::uuid ORDER BY p.created_at DESC LIMIT 20`),
    rows(sql`SELECT id, channel, event, status, recipient, created_at, sent_at FROM notification_logs
      WHERE transaction_id = ${id}::uuid AND is_test = false ORDER BY created_at DESC LIMIT 30`),
  ]);
  const x = extra[0]!;
  const paymentIds = pays.map((p) => String(p.id));
  const events = paymentIds.length
    ? await rows(sql`${eventSelect} WHERE e.payment_id IN (${sql.join(
        paymentIds.map((p) => sql`${p}::uuid`),
        sql`, `,
      )}) ORDER BY e.received_at DESC LIMIT 50`)
    : [];
  return {
    ...mapTrx(base),
    donorId: String(x.donor_id),
    campaignSlug: String(x.slug),
    prayer: (x.prayer as string | null) ?? null,
    whatsappOptIn: Boolean(x.whatsapp_opt_in),
    source: x.source ?? null,
    receiptIssuedAt: toDate(x.receipt_issued_at),
    donor: {
      id: String(x.donor_id),
      name: String(x.d_name),
      email: String(x.d_email),
      phone: (x.d_phone as string | null) ?? null,
      hasAccount: x.user_id !== null,
      anonymizedAt: toDate(x.anonymized_at),
    },
    payments: pays.map((p) => ({
      id: String(p.id),
      methodName: String(p.display_name),
      providerCode: String(p.provider_code),
      providerRef: (p.provider_ref as string | null) ?? null,
      amount: toBig(p.amount),
      feeAmount: toBig(p.fee),
      status: p.status as PaymentStatus,
      expiresAt: toDate(p.expires_at),
      paidAt: toDate(p.paid_at),
      failureReason: (p.failure_reason as string | null) ?? null,
      lastCheckedAt: toDate(p.last_checked_at),
      createdAt: new Date(String(p.created_at)),
    })),
    events: events.map(mapEvent),
    notifications: notifs.map((n) => ({
      id: String(n.id),
      channel: String(n.channel),
      event: String(n.event),
      status: String(n.status),
      recipient: String(n.recipient),
      createdAt: new Date(String(n.created_at)),
      sentAt: toDate(n.sent_at),
    })),
  };
}

/** Payment yang perlu dicek ke provider untuk satu transaksi (terbaru dulu, maks 3). */
export async function findCheckablePayments(
  transactionId: string,
): Promise<{ id: string; status: PaymentStatus; providerRef: string | null; providerCode: string }[]> {
  const r = await rows(sql`SELECT p.id, p.status, p.provider_ref, pp.code FROM payments p
    JOIN payment_providers pp ON pp.id = p.provider_id
    WHERE p.transaction_id = ${transactionId}::uuid
    ORDER BY (p.status IN ('pending', 'created')) DESC, p.created_at DESC LIMIT 3`);
  return r.map((p) => ({
    id: String(p.id),
    status: p.status as PaymentStatus,
    providerRef: (p.provider_ref as string | null) ?? null,
    providerCode: String(p.code),
  }));
}

// ---------------------------------------------------------------- Donatur

export function donorWhere(f: DonorFilter, exactPii: boolean): SQL {
  const w: SQL[] = [];
  if (f.tipe === "akun") w.push(sql`d.user_id IS NOT NULL`);
  if (f.tipe === "tamu") w.push(sql`d.user_id IS NULL`);
  if (f.q) {
    const q = f.q;
    const or: SQL[] = [sql`d.name ILIKE ${`%${escapeLike(q)}%`}`];
    if (q.includes("@")) or.push(exactPii ? sql`d.email = ${q}` : sql`d.email ILIKE ${`%${escapeLike(q)}%`}`);
    const phone = phoneQuery(q);
    if (phone) {
      or.push(exactPii ? sql`d.phone_e164 = ${phone}` : sql`d.phone_e164 LIKE ${`%${escapeLike(phone.slice(3))}%`}`);
    }
    w.push(sql`(${sql.join(or, sql` OR `)})`);
  }
  return and(w);
}

export interface AdminDonorRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hasAccount: boolean;
  anonymized: boolean;
  totalPaid: bigint;
  paidCount: number;
  lastPaidAt: Date | null;
  createdAt: Date;
}

const donorSelect = sql`SELECT d.id, d.name, d.email::text AS email, d.phone_e164, d.user_id IS NOT NULL AS has_account,
    d.anonymized_at IS NOT NULL AS anonymized, d.created_at,
    coalesce(s.total, 0)::text AS total, coalesce(s.n, 0)::int AS n, s.last_at
  FROM donors d
  LEFT JOIN LATERAL (
    SELECT sum(t.amount) AS total, count(*) AS n, max(t.paid_at) AS last_at
    FROM transactions t WHERE t.donor_id = d.id AND t.status = 'paid'
  ) s ON true`;

function mapDonor(r: Row): AdminDonorRow {
  return {
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    phone: (r.phone_e164 as string | null) ?? null,
    hasAccount: Boolean(r.has_account),
    anonymized: Boolean(r.anonymized),
    totalPaid: toBig(r.total),
    paidCount: Number(r.n ?? 0),
    lastPaidAt: toDate(r.last_at),
    createdAt: new Date(String(r.created_at)),
  };
}

const DONOR_ORDER = {
  total: sql`coalesce(s.total, 0) DESC, d.id`,
  terakhir: sql`s.last_at DESC NULLS LAST, d.id`,
  jumlah: sql`coalesce(s.n, 0) DESC, d.id`,
} as const;

export async function listAdminDonors(
  f: DonorFilter,
  page: number,
  exactPii: boolean,
): Promise<{ rows: AdminDonorRow[]; total: number }> {
  const where = donorWhere(f, exactPii);
  const [list, totals] = await Promise.all([
    rows(sql`${donorSelect} WHERE ${where} ORDER BY ${DONOR_ORDER[f.urut]}
      LIMIT ${FINANCE_PAGE_SIZE} OFFSET ${(page - 1) * FINANCE_PAGE_SIZE}`),
    rows(sql`SELECT count(*)::int AS n FROM donors d WHERE ${where}`),
  ]);
  return { rows: list.map(mapDonor), total: Number(totals[0]?.n ?? 0) };
}

export async function countAdminDonors(f: DonorFilter, exactPii: boolean): Promise<number> {
  const r = await rows(sql`SELECT count(*)::int AS n FROM donors d WHERE ${donorWhere(f, exactPii)}`);
  return Number(r[0]?.n ?? 0);
}

export async function donorExportBatch(
  f: DonorFilter,
  exactPii: boolean,
  after: string | null,
  limit: number,
): Promise<{ rows: AdminDonorRow[]; cursor: string | null }> {
  const keyset = after ? sql` AND d.id > ${after}::uuid` : sql``;
  const list = await rows(sql`${donorSelect} WHERE ${donorWhere(f, exactPii)}${keyset} ORDER BY d.id LIMIT ${limit}`);
  const last = list.at(-1);
  return { rows: list.map(mapDonor), cursor: last && list.length === limit ? String(last.id) : null };
}

export async function findAdminDonor(
  id: string,
): Promise<{ donor: AdminDonorRow; history: AdminTransactionRow[] } | null> {
  const [d] = await rows(sql`${donorSelect} WHERE d.id = ${id}::uuid`);
  if (!d) return null;
  const history = await rows(sql`${trxSelect} WHERE t.donor_id = ${id}::uuid ORDER BY t.created_at DESC LIMIT 20`);
  return { donor: mapDonor(d), history: history.map(mapTrx) };
}

// ---------------------------------------------------------------- Payment events

export interface AdminPaymentEventRow {
  id: string;
  providerCode: string;
  eventType: string;
  verification: string;
  result: string;
  statusReported: string | null;
  amountReported: bigint | null;
  paymentId: string | null;
  transactionId: string | null;
  transactionCode: string | null;
  errorMessage: string | null;
  receivedAt: Date;
}

const eventSelect = sql`SELECT e.id, pp.code AS provider_code, e.event_type, e.verification, e.result,
    e.status_reported, e.amount_reported::text AS amount_reported, e.payment_id, t.id AS trx_id, t.code AS trx_code,
    e.error_message, e.received_at
  FROM payment_events e
  JOIN payment_providers pp ON pp.id = e.provider_id
  LEFT JOIN payments p ON p.id = e.payment_id
  LEFT JOIN transactions t ON t.id = p.transaction_id`;

function mapEvent(r: Row): AdminPaymentEventRow {
  return {
    id: String(r.id),
    providerCode: String(r.provider_code),
    eventType: String(r.event_type),
    verification: String(r.verification),
    result: String(r.result),
    statusReported: (r.status_reported as string | null) ?? null,
    amountReported: r.amount_reported === null || r.amount_reported === undefined ? null : toBig(r.amount_reported),
    paymentId: (r.payment_id as string | null) ?? null,
    transactionId: (r.trx_id as string | null) ?? null,
    transactionCode: (r.trx_code as string | null) ?? null,
    errorMessage: (r.error_message as string | null) ?? null,
    receivedAt: new Date(String(r.received_at)),
  };
}

function eventWhere(q: PaymentEventQuery): SQL {
  const w: SQL[] = [];
  if (q.tipe) w.push(sql`e.event_type = ${q.tipe}`);
  if (q.verifikasi) w.push(sql`e.verification = ${q.verifikasi}`);
  if (q.hasil) w.push(sql`e.result = ${q.hasil}`);
  if (q.q) {
    if (TRX_CODE.test(q.q)) w.push(sql`t.code = ${q.q.toUpperCase()}`);
    else if (UUID.test(q.q)) w.push(sql`(e.payment_id = ${q.q}::uuid OR e.payload->>'order_id' = ${q.q.toLowerCase()})`);
    else w.push(sql`(p.provider_ref = ${q.q} OR e.provider_event_id = ${q.q})`);
  }
  return and(w);
}

export async function listPaymentEvents(q: PaymentEventQuery): Promise<{ rows: AdminPaymentEventRow[]; total: number }> {
  const where = eventWhere(q);
  const [list, totals] = await Promise.all([
    rows(sql`${eventSelect} WHERE ${where} ORDER BY e.received_at DESC, e.id DESC
      LIMIT ${FINANCE_PAGE_SIZE} OFFSET ${(q.hal - 1) * FINANCE_PAGE_SIZE}`),
    rows(sql`SELECT count(*)::int AS n FROM payment_events e
      LEFT JOIN payments p ON p.id = e.payment_id LEFT JOIN transactions t ON t.id = p.transaction_id
      WHERE ${where}`),
  ]);
  return { rows: list.map(mapEvent), total: Number(totals[0]?.n ?? 0) };
}

export async function findPaymentEvent(id: string): Promise<(AdminPaymentEventRow & { payload: unknown }) | null> {
  const [r] = await rows(sql`SELECT x.*, e.payload FROM (${eventSelect} WHERE e.id = ${id}::uuid) x
    JOIN payment_events e ON e.id = x.id`);
  return r ? { ...mapEvent(r), payload: r.payload } : null;
}

// ---------------------------------------------------------------- Audit log

export interface AdminAuditRow {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  ip: string | null;
  createdAt: Date;
}

export async function listAuditLogs(q: AuditQuery): Promise<{ rows: AdminAuditRow[]; total: number }> {
  const w: SQL[] = [];
  if (q.aktor === "system" || q.aktor === "provider" || q.aktor === "donor") w.push(sql`a.actor_type = ${q.aktor}`);
  else if (q.aktor) w.push(sql`a.actor_type = 'admin' AND a.actor_id = ${q.aktor}::uuid`);
  if (q.aksi) w.push(sql`a.action = ${q.aksi}`);
  if (q.entitas) w.push(sql`a.entity_type = ${q.entitas}`);
  if (q.q) w.push(sql`a.entity_id = ${q.q}`);
  const where = and(w);
  const [list, totals] = await Promise.all([
    rows(sql`SELECT a.id::text AS id, a.actor_type, a.actor_id, u.name AS actor_name, a.action, a.entity_type,
        a.entity_id, a.before, a.after, a.metadata, host(a.ip) AS ip, a.created_at
      FROM audit_logs a LEFT JOIN admin_users u ON u.id = a.actor_id AND a.actor_type = 'admin'
      WHERE ${where} ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${FINANCE_PAGE_SIZE} OFFSET ${(q.hal - 1) * FINANCE_PAGE_SIZE}`),
    rows(sql`SELECT count(*)::int AS n FROM audit_logs a WHERE ${where}`),
  ]);
  return {
    rows: list.map((r) => ({
      id: String(r.id),
      actorType: String(r.actor_type),
      actorId: (r.actor_id as string | null) ?? null,
      actorName: (r.actor_name as string | null) ?? null,
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: (r.entity_id as string | null) ?? null,
      before: r.before ?? null,
      after: r.after ?? null,
      metadata: r.metadata ?? null,
      ip: (r.ip as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    })),
    total: Number(totals[0]?.n ?? 0),
  };
}

export async function auditFilterOptions(): Promise<{
  admins: { id: string; name: string }[];
  actions: string[];
  entities: string[];
}> {
  const [admins, actions, entities] = await Promise.all([
    rows(sql`SELECT id, name FROM admin_users ORDER BY name LIMIT 200`),
    rows(sql`SELECT DISTINCT action FROM audit_logs ORDER BY action LIMIT 200`),
    rows(sql`SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type LIMIT 100`),
  ]);
  return {
    admins: admins.map((a) => ({ id: String(a.id), name: String(a.name) })),
    actions: actions.map((a) => String(a.action)),
    entities: entities.map((e) => String(e.entity_type)),
  };
}

// ---------------------------------------------------------------- Metode pembayaran

export interface AdminMethodRow {
  id: string;
  code: string;
  providerCode: string;
  providerChannel: string;
  type: string;
  displayName: string;
  logoUrl: string | null;
  instructions: unknown;
  minAmount: bigint;
  maxAmount: bigint | null;
  expiryMinutes: number;
  feeFlat: bigint;
  feePercent: string;
  feeBorneBy: string;
  isActive: boolean;
  displayOrder: number;
}

export async function listAdminMethods(): Promise<AdminMethodRow[]> {
  const r = await rows(sql`SELECT m.id, m.code, pp.code AS provider_code, m.provider_channel, m.type, m.display_name,
      m.logo_url, m.instructions, m.min_amount::text AS min_amount, m.max_amount::text AS max_amount, m.expiry_minutes,
      m.fee_flat::text AS fee_flat, m.fee_percent::text AS fee_percent, m.fee_borne_by, m.is_active, m.display_order
    FROM payment_methods m JOIN payment_providers pp ON pp.id = m.provider_id
    ORDER BY m.display_order, m.code`);
  return r.map((m) => ({
    id: String(m.id),
    code: String(m.code),
    providerCode: String(m.provider_code),
    providerChannel: String(m.provider_channel),
    type: String(m.type),
    displayName: String(m.display_name),
    logoUrl: (m.logo_url as string | null) ?? null,
    instructions: m.instructions ?? [],
    minAmount: toBig(m.min_amount),
    maxAmount: m.max_amount === null ? null : toBig(m.max_amount),
    expiryMinutes: Number(m.expiry_minutes),
    feeFlat: toBig(m.fee_flat),
    feePercent: String(m.fee_percent),
    feeBorneBy: String(m.fee_borne_by),
    isActive: Boolean(m.is_active),
    displayOrder: Number(m.display_order),
  }));
}

export interface ProviderStatusRow {
  code: string;
  name: string;
  isEnabled: boolean;
  lastWebhookAt: Date | null;
}

export async function listProviderStatus(): Promise<ProviderStatusRow[]> {
  const r = await rows(sql`SELECT pp.code, pp.name, pp.is_enabled,
      (SELECT max(e.received_at) FROM payment_events e WHERE e.provider_id = pp.id AND e.event_type = 'notification') AS last_hook
    FROM payment_providers pp ORDER BY pp.priority, pp.code`);
  return r.map((p) => ({
    code: String(p.code),
    name: String(p.name),
    isEnabled: Boolean(p.is_enabled),
    lastWebhookAt: toDate(p.last_hook),
  }));
}
