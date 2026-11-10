import "server-only";
import { and, desc, eq, inArray, isNull, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaignNews, campaigns, paymentEvents, paymentMethods, payments, transactions } from "@/lib/db/schema";
import type { DonorStatusFilter, DonorTrxCursor } from "@/lib/validation/donor";

// SEMUA query di file ini WAJIB memfilter `transactions.donor_id = donorId` dari sesi (F-13,
// security.md §3). Tidak ada fungsi yang menerima kode transaksi tanpa donorId.

export type TrxStatus = (typeof transactions.$inferSelect)["status"];

export interface DonorSummary {
  totalPaid: bigint;
  paidCount: number;
  campaignCount: number;
  pendingCount: number;
}

export async function getDonorSummary(donorId: string): Promise<DonorSummary> {
  const [row] = await getDb()
    .select({
      totalPaid: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.status} = 'paid'), 0)::text`,
      paidCount: sql<number>`(count(*) filter (where ${transactions.status} = 'paid'))::int`,
      campaignCount: sql<number>`(count(distinct ${transactions.campaignId}) filter (where ${transactions.status} = 'paid'))::int`,
      pendingCount: sql<number>`(count(*) filter (where ${transactions.status} in ('created','pending')))::int`,
    })
    .from(transactions)
    .where(eq(transactions.donorId, donorId));
  return {
    totalPaid: BigInt(row?.totalPaid ?? "0"),
    paidCount: row?.paidCount ?? 0,
    campaignCount: row?.campaignCount ?? 0,
    pendingCount: row?.pendingCount ?? 0,
  };
}

export interface DonorTrxListItem {
  id: string;
  code: string;
  amount: bigint;
  status: TrxStatus;
  campaignTitle: string;
  createdAt: Date;
  methodName: string | null;
}

/** Metode dari payment terbaru non-`created` (bila ada). */
const latestMethod = sql<string | null>`(
  select pm.display_name from payments p
  inner join payment_methods pm on pm.id = p.payment_method_id
  where p.transaction_id = transactions.id and p.status <> 'created'
  order by (p.status in ('pending','paid')) desc, p.created_at desc
  limit 1)`;

const listColumns = {
  id: transactions.id,
  code: transactions.code,
  amount: transactions.amount,
  status: transactions.status,
  campaignTitle: transactions.campaignTitleSnapshot,
  createdAt: transactions.createdAt,
  methodName: latestMethod,
};

// Presisi Postgres mikrodetik vs JS milidetik → keyset pada milidetik (lihat public-campaigns).
const createdMs = sql`date_trunc('milliseconds', ${transactions.createdAt})`;

function statusWhere(status: DonorStatusFilter | undefined): SQL | undefined {
  if (!status) return undefined;
  if (status === "pending") return inArray(transactions.status, ["created", "pending"]);
  return eq(transactions.status, status);
}

/** Tahun kalender Asia/Jakarta. */
function yearWhere(year: number | undefined): SQL | undefined {
  if (!year) return undefined;
  return sql`${transactions.createdAt} >= ${`${year}-01-01T00:00:00+07:00`}::timestamptz and ${transactions.createdAt} < ${`${year + 1}-01-01T00:00:00+07:00`}::timestamptz`;
}

export async function listRecentDonorTransactions(donorId: string, limit = 5): Promise<DonorTrxListItem[]> {
  return getDb()
    .select(listColumns)
    .from(transactions)
    .where(eq(transactions.donorId, donorId))
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(limit);
}

export interface DonorTrxPage {
  items: DonorTrxListItem[];
  /** Cursor untuk halaman berikutnya / sebelumnya (null = tidak ada). */
  next: DonorTrxCursor | null;
  prev: DonorTrxCursor | null;
}

/**
 * Riwayat donor, keyset `created_at DESC, id DESC`, ukuran halaman tetap. `after` = lanjut ke
 * baris lebih lama; `before` = kembali ke baris lebih baru. Tanpa OFFSET.
 */
export async function listDonorTransactionsPage(args: {
  donorId: string;
  status?: DonorStatusFilter;
  year?: number;
  after?: DonorTrxCursor | null;
  before?: DonorTrxCursor | null;
  pageSize: number;
}): Promise<DonorTrxPage> {
  const backward = !args.after && !!args.before;
  const cursor = args.after ?? args.before ?? null;
  let keyset: SQL | undefined;
  if (cursor) {
    const at = cursor.createdAt.toISOString();
    keyset = backward
      ? or(sql`${createdMs} > ${at}::timestamptz`, and(sql`${createdMs} = ${at}::timestamptz`, sql`${transactions.id} > ${cursor.id}`))
      : or(sql`${createdMs} < ${at}::timestamptz`, and(sql`${createdMs} = ${at}::timestamptz`, sql`${transactions.id} < ${cursor.id}`));
  }
  const rows = await getDb()
    .select(listColumns)
    .from(transactions)
    .where(and(eq(transactions.donorId, args.donorId), statusWhere(args.status), yearWhere(args.year), keyset))
    .orderBy(...(backward ? [sql`${createdMs} asc`, sql`${transactions.id} asc`] : [sql`${createdMs} desc`, desc(transactions.id)]))
    .limit(args.pageSize + 1);
  const more = rows.length > args.pageSize;
  const page = rows.slice(0, args.pageSize);
  if (backward) page.reverse();
  const first = page[0];
  const last = page.at(-1);
  const key = (r: DonorTrxListItem) => ({ createdAt: r.createdAt, id: r.id });
  return {
    items: page,
    next: last && (backward ? true : more) ? key(last) : null,
    prev: first && (backward ? more : !!cursor) ? key(first) : null,
  };
}

/** Tahun (Asia/Jakarta) yang punya transaksi milik donor, terbaru dulu. */
export async function listDonorTransactionYears(donorId: string): Promise<number[]> {
  const rows = await getDb()
    .selectDistinct({ y: sql<number>`extract(year from ${transactions.createdAt} at time zone 'Asia/Jakarta')::int` })
    .from(transactions)
    .where(eq(transactions.donorId, donorId));
  return rows.map((r) => r.y).sort((a, b) => b - a);
}

/** Transaksi pending tertua yang masih bisa dibayar (untuk ajakan lanjut bayar). */
export async function findLatestPayableTransaction(donorId: string) {
  const [row] = await getDb()
    .select({
      code: transactions.code,
      amount: transactions.amount,
      campaignTitle: transactions.campaignTitleSnapshot,
      expiresAt: sql<string | null>`(select max(p.expires_at) from payments p where p.transaction_id = transactions.id and p.status = 'pending')`.mapWith((v: string | null) => (v ? new Date(v) : null)),
    })
    .from(transactions)
    .where(and(eq(transactions.donorId, donorId), inArray(transactions.status, ["created", "pending"])))
    .orderBy(desc(transactions.createdAt))
    .limit(1);
  return row;
}

export async function findDonorTransaction(donorId: string, code: string) {
  const [row] = await getDb()
    .select({
      id: transactions.id,
      code: transactions.code,
      amount: transactions.amount,
      status: transactions.status,
      campaignId: transactions.campaignId,
      campaignTitle: transactions.campaignTitleSnapshot,
      campaignSlug: campaigns.slug,
      campaignStatus: campaigns.status,
      donorName: transactions.donorNameSnapshot,
      isAnonymous: transactions.isAnonymous,
      prayer: transactions.prayer,
      paidAt: transactions.paidAt,
      receiptNo: transactions.receiptNo,
      receiptIssuedAt: transactions.receiptIssuedAt,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
    })
    .from(transactions)
    .innerJoin(campaigns, eq(transactions.campaignId, campaigns.id))
    .where(and(eq(transactions.donorId, donorId), eq(transactions.code, code)))
    .limit(1);
  return row;
}

/** Payment milik transaksi (sudah diverifikasi milik donor oleh pemanggil). Tanpa data provider. */
export async function listTransactionPayments(transactionId: string) {
  return getDb()
    .select({
      id: payments.id,
      status: payments.status,
      methodName: paymentMethods.displayName,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      paidAt: payments.paidAt,
      expiresAt: payments.expiresAt,
    })
    .from(payments)
    .innerJoin(paymentMethods, eq(payments.paymentMethodId, paymentMethods.id))
    .where(and(eq(payments.transactionId, transactionId), notInArray(payments.status, ["created"])))
    .orderBy(payments.createdAt);
}

/** Event provider terverifikasi & diproses — hanya status + waktu, TANPA payload. */
export async function listProcessedPaymentEvents(paymentIds: string[]) {
  if (paymentIds.length === 0) return [];
  return getDb()
    .select({
      paymentId: paymentEvents.paymentId,
      statusReported: paymentEvents.statusReported,
      receivedAt: paymentEvents.receivedAt,
    })
    .from(paymentEvents)
    .where(
      and(
        inArray(paymentEvents.paymentId, paymentIds),
        eq(paymentEvents.verification, "verified"),
        eq(paymentEvents.result, "processed"),
      ),
    )
    .orderBy(paymentEvents.receivedAt);
}

export async function findLatestCampaignNews(campaignId: string) {
  const [row] = await getDb()
    .select({ title: campaignNews.title, slug: campaignNews.slug, publishedAt: campaignNews.publishedAt })
    .from(campaignNews)
    .where(
      and(
        eq(campaignNews.campaignId, campaignId),
        eq(campaignNews.status, "published"),
        isNull(campaignNews.deletedAt),
        lte(campaignNews.publishedAt, sql`now()`),
      ),
    )
    .orderBy(desc(campaignNews.publishedAt))
    .limit(1);
  return row;
}

/** Ganti access token transaksi milik donor yang masih bisa dibayar (hash saja di DB). */
export async function reissueAccessToken(args: {
  donorId: string;
  code: string;
  tokenHash: Buffer;
  expiresAt: Date;
}) {
  const [row] = await getDb()
    .update(transactions)
    .set({ accessTokenHash: args.tokenHash, accessTokenExpiresAt: args.expiresAt, updatedAt: sql`now()` })
    .where(
      and(
        eq(transactions.donorId, args.donorId),
        eq(transactions.code, args.code),
        inArray(transactions.status, ["created", "pending"]),
      ),
    )
    .returning({ id: transactions.id, code: transactions.code, status: transactions.status, campaignId: transactions.campaignId });
  if (!row) return undefined;
  const [c] = await getDb().select({ slug: campaigns.slug }).from(campaigns).where(eq(campaigns.id, row.campaignId)).limit(1);
  return { ...row, campaignSlug: c?.slug ?? null };
}
