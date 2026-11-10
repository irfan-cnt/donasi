import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  campaignAmountOptions,
  campaignCategories,
  campaignDisbursements,
  campaignImages,
  campaignNews,
  campaigns,
  transactions,
} from "@/lib/db/schema";
import type { CampaignStatusCode } from "@/lib/campaign-rules";
import { CAMPAIGN_PAGE_SIZE, type AdminCampaignListQuery } from "@/lib/validation/admin-campaign";

// Akses DB admin campaign/berita/penyaluran (P21). Penulisan multi-tabel ada di service
// (satu transaksi DB bersama audit log).

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`);

export interface AdminCampaignRow {
  id: string;
  title: string;
  slug: string;
  status: CampaignStatusCode;
  amountType: "open" | "fixed";
  categoryName: string;
  featuredImageUrl: string | null;
  targetAmount: bigint | null;
  collectedAmount: bigint;
  donorCount: number;
  endAt: Date | null;
  updatedAt: Date;
}

export async function listAdminCampaigns(
  q: AdminCampaignListQuery,
): Promise<{ rows: AdminCampaignRow[]; total: number }> {
  const where: SQL[] = [];
  // ILIKE memakai indeks GIN pg_trgm campaigns_title_trgm_idx.
  if (q.q) where.push(ilike(campaigns.title, `%${escapeLike(q.q)}%`));
  if (q.status) where.push(eq(campaigns.status, q.status));
  if (q.kategori) where.push(eq(campaigns.categoryId, q.kategori));
  if (q.tipe) where.push(eq(campaigns.amountType, q.tipe));
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        slug: campaigns.slug,
        status: campaigns.status,
        amountType: campaigns.amountType,
        categoryName: campaignCategories.name,
        featuredImageUrl: campaigns.featuredImageUrl,
        targetAmount: campaigns.targetAmount,
        collectedAmount: campaigns.collectedAmount,
        donorCount: campaigns.donorCount,
        endAt: campaigns.endAt,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .innerJoin(campaignCategories, eq(campaigns.categoryId, campaignCategories.id))
      .where(cond)
      .orderBy(desc(campaigns.updatedAt), desc(campaigns.id))
      .limit(CAMPAIGN_PAGE_SIZE)
      .offset((q.hal - 1) * CAMPAIGN_PAGE_SIZE),
    db.select({ n: count() }).from(campaigns).where(cond),
  ]);
  return { rows, total: totals[0]?.n ?? 0 };
}

export async function listCategoryOptions(): Promise<{ id: string; name: string }[]> {
  return getDb()
    .select({ id: campaignCategories.id, name: campaignCategories.name })
    .from(campaignCategories)
    .orderBy(asc(campaignCategories.sortOrder), asc(campaignCategories.name));
}

export async function listCampaignOptions(): Promise<{ id: string; title: string; slug: string }[]> {
  return getDb()
    .select({ id: campaigns.id, title: campaigns.title, slug: campaigns.slug })
    .from(campaigns)
    .where(ne(campaigns.status, "archived"))
    .orderBy(desc(campaigns.updatedAt))
    .limit(500);
}

export type CampaignRow = typeof campaigns.$inferSelect;
export type AmountOptionRow = typeof campaignAmountOptions.$inferSelect;
export type ImageRow = typeof campaignImages.$inferSelect;

export async function findCampaignById(id: string): Promise<CampaignRow | undefined> {
  const rows = await getDb().select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return rows[0];
}

export async function findCampaignOptions(id: string): Promise<AmountOptionRow[]> {
  return getDb()
    .select()
    .from(campaignAmountOptions)
    .where(eq(campaignAmountOptions.campaignId, id))
    .orderBy(asc(campaignAmountOptions.sortOrder), asc(campaignAmountOptions.amount));
}

export async function findCampaignImages(id: string): Promise<ImageRow[]> {
  return getDb()
    .select()
    .from(campaignImages)
    .where(eq(campaignImages.campaignId, id))
    .orderBy(asc(campaignImages.sortOrder), asc(campaignImages.createdAt));
}

export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(exceptId ? and(eq(campaigns.slug, slug), ne(campaigns.id, exceptId)) : eq(campaigns.slug, slug))
    .limit(1);
  return rows.length > 0;
}

export async function countCampaignTransactions(
  campaignId: string,
): Promise<{ total: number; pending: number }> {
  const [row] = await getDb()
    .select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${transactions.status} in ('created', 'pending'))::int`,
    })
    .from(transactions)
    .where(eq(transactions.campaignId, campaignId));
  return { total: row?.total ?? 0, pending: row?.pending ?? 0 };
}

/** Id opsi nominal yang sudah dipakai transaksi (tidak boleh dihapus; FK RESTRICT). */
export async function usedAmountOptionIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await getDb()
    .selectDistinct({ id: transactions.amountOptionId })
    .from(transactions)
    .where(and(isNotNull(transactions.amountOptionId), inArray(transactions.amountOptionId, ids)));
  return new Set(rows.map((r) => r.id!).filter(Boolean));
}

export interface CampaignNewsBrief {
  id: string;
  title: string;
  status: "draft" | "published";
  publishedAt: Date | null;
}

export async function listNewsForCampaign(campaignId: string): Promise<CampaignNewsBrief[]> {
  return getDb()
    .select({
      id: campaignNews.id,
      title: campaignNews.title,
      status: campaignNews.status,
      publishedAt: campaignNews.publishedAt,
    })
    .from(campaignNews)
    .where(and(eq(campaignNews.campaignId, campaignId), isNull(campaignNews.deletedAt)))
    .orderBy(desc(campaignNews.createdAt))
    .limit(50);
}

export interface DisbursementRow {
  id: string;
  amount: bigint;
  kind: "program" | "operational" | "bank_fee";
  description: string;
  disbursedAt: string;
  newsId: string | null;
  newsTitle: string | null;
}

export async function listDisbursements(campaignId: string): Promise<DisbursementRow[]> {
  return getDb()
    .select({
      id: campaignDisbursements.id,
      amount: campaignDisbursements.amount,
      kind: campaignDisbursements.kind,
      description: campaignDisbursements.description,
      disbursedAt: campaignDisbursements.disbursedAt,
      newsId: campaignDisbursements.newsId,
      newsTitle: campaignNews.title,
    })
    .from(campaignDisbursements)
    .leftJoin(campaignNews, eq(campaignDisbursements.newsId, campaignNews.id))
    .where(and(eq(campaignDisbursements.campaignId, campaignId), isNull(campaignDisbursements.deletedAt)))
    .orderBy(desc(campaignDisbursements.disbursedAt), desc(campaignDisbursements.createdAt));
}

// ---------- Berita ----------

export type NewsRow = typeof campaignNews.$inferSelect;

export interface AdminNewsRow {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  publishedAt: Date | null;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
}

export async function listAdminNews(q: {
  q?: string;
  campaign?: string;
  status?: "draft" | "published";
  hal: number;
}): Promise<{ rows: AdminNewsRow[]; total: number }> {
  const where: SQL[] = [isNull(campaignNews.deletedAt)];
  if (q.q) where.push(ilike(campaignNews.title, `%${escapeLike(q.q)}%`));
  if (q.campaign) where.push(eq(campaignNews.campaignId, q.campaign));
  if (q.status) where.push(eq(campaignNews.status, q.status));
  const cond = and(...where);
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: campaignNews.id,
        title: campaignNews.title,
        slug: campaignNews.slug,
        status: campaignNews.status,
        publishedAt: campaignNews.publishedAt,
        campaignId: campaignNews.campaignId,
        campaignTitle: campaigns.title,
        campaignSlug: campaigns.slug,
      })
      .from(campaignNews)
      .innerJoin(campaigns, eq(campaignNews.campaignId, campaigns.id))
      .where(cond)
      .orderBy(desc(campaignNews.updatedAt), desc(campaignNews.id))
      .limit(CAMPAIGN_PAGE_SIZE)
      .offset((q.hal - 1) * CAMPAIGN_PAGE_SIZE),
    db.select({ n: count() }).from(campaignNews).where(cond),
  ]);
  return { rows, total: totals[0]?.n ?? 0 };
}

export async function findNewsById(id: string): Promise<NewsRow | undefined> {
  const rows = await getDb()
    .select()
    .from(campaignNews)
    .where(and(eq(campaignNews.id, id), isNull(campaignNews.deletedAt)))
    .limit(1);
  return rows[0];
}

/** Slug berita unik per campaign — termasuk baris soft delete (constraint DB tetap berlaku). */
export async function newsSlugTaken(campaignId: string, slug: string, exceptId?: string): Promise<boolean> {
  const cond = [eq(campaignNews.campaignId, campaignId), eq(campaignNews.slug, slug)];
  if (exceptId) cond.push(ne(campaignNews.id, exceptId));
  const rows = await getDb().select({ id: campaignNews.id }).from(campaignNews).where(and(...cond)).limit(1);
  return rows.length > 0;
}
