import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

// Agregat dashboard admin (F-23). Batas hari = tengah malam Asia/Jakarta; `from`/`to` adalah
// tanggal kalender inklusif (YYYY-MM-DD, sudah divalidasi Zod). Tidak ada cache lintas admin.

export type TrxStatus = "created" | "pending" | "paid" | "expired" | "failed" | "cancelled" | "refunded";

const startOf = (day: string) => sql`(${day}::date::timestamp at time zone 'Asia/Jakarta')`;
const endOf = (day: string) => sql`((${day}::date + 1)::timestamp at time zone 'Asia/Jakarta')`;

type Row = Record<string, unknown>;
async function rows(query: ReturnType<typeof sql>): Promise<Row[]> {
  const res = await getDb().execute(query);
  return res.rows as Row[];
}

export interface TransactionKpis {
  paidAmount: bigint;
  paidCount: number;
  pendingCount: number;
  pendingAmount: bigint;
  donorCount: number;
  prevPaidAmount: bigint;
}

/** KPI transaksi (butuh transactions.read). Paid dihitung dari paid_at; pending dari created_at. */
export async function getTransactionKpis(
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): Promise<TransactionKpis> {
  const [paid, pending, prev] = await Promise.all([
    rows(sql`select coalesce(sum(amount), 0)::text as amount, count(*)::int as n,
        count(distinct donor_id)::int as donors
      from transactions
      where status = 'paid' and paid_at >= ${startOf(from)} and paid_at < ${endOf(to)}`),
    rows(sql`select coalesce(sum(amount), 0)::text as amount, count(*)::int as n
      from transactions
      where status in ('created', 'pending') and created_at >= ${startOf(from)} and created_at < ${endOf(to)}`),
    rows(sql`select coalesce(sum(amount), 0)::text as amount
      from transactions
      where status = 'paid' and paid_at >= ${startOf(prevFrom)} and paid_at < ${endOf(prevTo)}`),
  ]);
  return {
    paidAmount: BigInt(String(paid[0]?.amount ?? "0")),
    paidCount: Number(paid[0]?.n ?? 0),
    donorCount: Number(paid[0]?.donors ?? 0),
    pendingAmount: BigInt(String(pending[0]?.amount ?? "0")),
    pendingCount: Number(pending[0]?.n ?? 0),
    prevPaidAmount: BigInt(String(prev[0]?.amount ?? "0")),
  };
}

export interface DailyPoint {
  day: string;
  amount: bigint;
  count: number;
}

/** Donasi paid per hari Asia/Jakarta (hari tanpa donasi = 0). */
export async function getDailyPaid(from: string, to: string): Promise<DailyPoint[]> {
  const res = await rows(sql`
    with agg as (
      select (paid_at at time zone 'Asia/Jakarta')::date as day, sum(amount) as amount, count(*)::int as n
      from transactions
      where status = 'paid' and paid_at >= ${startOf(from)} and paid_at < ${endOf(to)}
      group by 1
    )
    select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(agg.amount, 0)::text as amount, coalesce(agg.n, 0) as n
    from generate_series(${from}::date, ${to}::date, interval '1 day') d
    left join agg on agg.day = d::date
    order by d`);
  return res.map((r) => ({ day: String(r.day), amount: BigInt(String(r.amount)), count: Number(r.n) }));
}

export interface CampaignCounts {
  active: number;
  paused: number;
}

/** Jumlah campaign aktif (published) & dijeda — butuh campaigns.read. */
export async function getCampaignCounts(): Promise<CampaignCounts> {
  const [r] = await rows(sql`select count(*) filter (where status = 'published')::int as active,
      count(*) filter (where status = 'paused')::int as paused
    from campaigns`);
  return { active: Number(r?.active ?? 0), paused: Number(r?.paused ?? 0) };
}

export interface CampaignPerformance {
  id: string;
  title: string;
  collected: bigint;
  target: bigint | null;
  donorCount: number;
}

/** Top 5 campaign published berdasarkan terkumpul (data campaign, bukan PII). */
export async function getTopCampaigns(limit = 5): Promise<CampaignPerformance[]> {
  const res = await rows(sql`select id, title, collected_amount::text as collected,
      target_amount::text as target, donor_count
    from campaigns where status = 'published'
    order by collected_amount desc, published_at desc nulls last
    limit ${limit}`);
  return res.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    collected: BigInt(String(r.collected)),
    target: r.target == null ? null : BigInt(String(r.target)),
    donorCount: Number(r.donor_count),
  }));
}

export interface LatestTransaction {
  code: string;
  donorName: string;
  campaignTitle: string;
  amount: bigint;
  status: TrxStatus;
  methodName: string | null;
  createdAt: Date;
}

/** Transaksi terbaru dalam rentang (tanpa email/telepon donatur). */
export async function getLatestTransactions(from: string, to: string, limit = 8): Promise<LatestTransaction[]> {
  const res = await rows(sql`select t.code, t.donor_name_snapshot as donor, t.campaign_title_snapshot as campaign,
      t.amount::text as amount, t.status::text as status, t.created_at,
      (select pm.display_name from payments p join payment_methods pm on pm.id = p.payment_method_id
        where p.transaction_id = t.id and p.status <> 'created'
        order by (p.status in ('pending', 'paid')) desc, p.created_at desc limit 1) as method
    from transactions t
    where t.created_at >= ${startOf(from)} and t.created_at < ${endOf(to)}
    order by t.created_at desc
    limit ${limit}`);
  return res.map((r) => ({
    code: String(r.code),
    donorName: String(r.donor),
    campaignTitle: String(r.campaign),
    amount: BigInt(String(r.amount)),
    status: String(r.status) as TrxStatus,
    methodName: r.method == null ? null : String(r.method),
    createdAt: new Date(String(r.created_at)),
  }));
}

// ---------- Pencarian global ----------

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function searchTransactionsByCode(prefix: string, limit = 5) {
  const res = await rows(sql`select code, campaign_title_snapshot as campaign, status::text as status
    from transactions where code like ${likeEscape(prefix.toUpperCase()) + "%"}
    order by created_at desc limit ${limit}`);
  return res.map((r) => ({ code: String(r.code), campaignTitle: String(r.campaign), status: String(r.status) }));
}

export async function searchDonorsByEmail(q: string, opts: { exact: boolean }, limit = 5) {
  const match = opts.exact ? sql`email = ${q.toLowerCase()}` : sql`email like ${likeEscape(q.toLowerCase()) + "%"}`;
  const res = await rows(sql`select id, name, email::text as email from donors
    where anonymized_at is null and ${match}
    order by email limit ${limit}`);
  return res.map((r) => ({ id: String(r.id), name: String(r.name), email: String(r.email) }));
}

export async function searchCampaignsByTitle(q: string, limit = 5) {
  const res = await rows(sql`select id, title, status::text as status from campaigns
    where title ilike ${"%" + likeEscape(q) + "%"}
    order by updated_at desc limit ${limit}`);
  return res.map((r) => ({ id: String(r.id), title: String(r.title), status: String(r.status) }));
}
