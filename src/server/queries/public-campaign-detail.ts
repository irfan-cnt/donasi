import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/lib/db";
import {
  campaignCategories,
  campaignDisbursements,
  campaignImages,
  campaignNews,
  campaigns,
  transactions,
} from "@/lib/db/schema";
import { formatRelativePast } from "@/lib/format/relative-time";
import { sanitizeRichText } from "@/lib/sanitize";
import { CAMPAIGNS_TAG, campaignTag } from "./public-campaigns";

// Data publik detail campaign & berita. TIDAK PERNAH memilih kolom email/telepon donatur:
// daftar donasi hanya nama tampil (snapshot / "Hamba Allah"), doa, dan waktu (AC-02.4).

// stale ≥ 300 s: syarat konten cache masuk App Shell (Partial Prefetching) — di bawah itu Next.js
// memperlakukannya sebagai data tak ter-cache di shell & validasi instant dev menandai "Blocking Route".
// `stale` hanya umur cache router klien; kesegaran server tetap diatur `revalidate` + tag.
const ISR_LIFE = { stale: 300, revalidate: 60, expire: 3600 } as const;
const PUBLIC_STATUSES = ["published", "paused", "completed"] as const;
const PLACEHOLDER = "/images/sample/placeholder.svg";

export type PublicCampaignStatus = "draft" | "published" | "paused" | "completed" | "archived";

export interface CampaignImage {
  url: string;
  alt: string;
}

export interface CampaignNewsItem {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date;
}

export interface RecentDonation {
  name: string;
  prayer: string | null;
  amount: bigint;
  /** Label waktu relatif Asia/Jakarta, dihitung saat render ISR. */
  timeLabel: string;
}

export interface DisbursementSummary {
  program: bigint;
  operational: bigint;
  bankFee: bigint;
  total: bigint;
  count: number;
}

export interface CampaignDetail {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  descriptionHtml: string;
  seoTitle: string | null;
  seoDescription: string | null;
  categoryName: string;
  categorySlug: string;
  status: PublicCampaignStatus;
  images: CampaignImage[];
  targetAmount: bigint | null;
  collectedAmount: bigint;
  donorCount: number;
  daysLeft: number | null;
  publishedAt: Date | null;
  updatedAt: Date;
  disbursements: DisbursementSummary;
  news: CampaignNewsItem[];
  newsCount: number;
  donations: RecentDonation[];
}

export interface CampaignSummary {
  id: string;
  slug: string;
  title: string;
  status: PublicCampaignStatus;
  imageUrl: string;
  imageAlt: string;
  targetAmount: bigint | null;
  collectedAmount: bigint;
}

export interface NewsDetail {
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string;
  imageUrl: string | null;
  imageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date;
  updatedAt: Date;
  campaign: CampaignSummary;
  otherNews: CampaignNewsItem[];
}

const daysLeftSql = sql<
  number | null
>`case when ${campaigns.endAt} is null then null else greatest(0, ceil(extract(epoch from (${campaigns.endAt} - now())) / 86400))::int end`;

const publishedNews = (campaignId: string) =>
  and(
    eq(campaignNews.campaignId, campaignId),
    eq(campaignNews.status, "published"),
    isNull(campaignNews.deletedAt),
  );

async function loadCampaignDetail(where: SQL): Promise<CampaignDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      shortDescription: campaigns.shortDescription,
      descriptionHtml: campaigns.descriptionHtml,
      seoTitle: campaigns.seoTitle,
      seoDescription: campaigns.seoDescription,
      featuredImageUrl: campaigns.featuredImageUrl,
      featuredImageAlt: campaigns.featuredImageAlt,
      categoryName: campaignCategories.name,
      categorySlug: campaignCategories.slug,
      status: campaigns.status,
      targetAmount: campaigns.targetAmount,
      collectedAmount: campaigns.collectedAmount,
      donorCount: campaigns.donorCount,
      daysLeft: daysLeftSql,
      publishedAt: campaigns.publishedAt,
      updatedAt: campaigns.updatedAt,
    })
    .from(campaigns)
    .innerJoin(campaignCategories, eq(campaigns.categoryId, campaignCategories.id))
    .where(where)
    .limit(1);
  if (!row) return null;

  const [gallery, disb, news, newsCount, donations] = await Promise.all([
    db
      .select({ url: campaignImages.url, alt: campaignImages.alt })
      .from(campaignImages)
      .where(eq(campaignImages.campaignId, row.id))
      .orderBy(asc(campaignImages.sortOrder), asc(campaignImages.createdAt))
      .limit(12),
    db
      .select({
        kind: campaignDisbursements.kind,
        total: sql<string>`coalesce(sum(${campaignDisbursements.amount}), 0)::text`,
        n: sql<number>`count(*)::int`,
      })
      .from(campaignDisbursements)
      .where(
        and(eq(campaignDisbursements.campaignId, row.id), isNull(campaignDisbursements.deletedAt)),
      )
      .groupBy(campaignDisbursements.kind),
    db
      .select({
        slug: campaignNews.slug,
        title: campaignNews.title,
        excerpt: campaignNews.excerpt,
        publishedAt: campaignNews.publishedAt,
      })
      .from(campaignNews)
      .where(publishedNews(row.id))
      .orderBy(desc(campaignNews.publishedAt))
      .limit(3),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(campaignNews)
      .where(publishedNews(row.id)),
    db
      .select({
        name: transactions.donorNameSnapshot,
        isAnonymous: transactions.isAnonymous,
        prayer: transactions.prayer,
        amount: transactions.amount,
        paidAt: transactions.paidAt,
      })
      .from(transactions)
      .where(and(eq(transactions.campaignId, row.id), eq(transactions.status, "paid")))
      .orderBy(desc(transactions.paidAt))
      .limit(10),
  ]);

  const sumOf = (kind: string) => BigInt(disb.find((d) => d.kind === kind)?.total ?? "0");
  const program = sumOf("program");
  const operational = sumOf("operational");
  const bankFee = sumOf("bank_fee");
  const now = new Date();

  const featured: CampaignImage = {
    url: row.featuredImageUrl ?? PLACEHOLDER,
    alt: row.featuredImageAlt ?? row.title,
  };
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription,
    descriptionHtml: sanitizeRichText(row.descriptionHtml),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    status: row.status,
    images: [featured, ...gallery.filter((g) => g.url !== featured.url)],
    targetAmount: row.targetAmount,
    collectedAmount: row.collectedAmount,
    donorCount: row.donorCount,
    daysLeft: row.status === "completed" ? null : row.daysLeft,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    disbursements: {
      program,
      operational,
      bankFee,
      total: program + operational + bankFee,
      count: disb.reduce((n, d) => n + d.n, 0),
    },
    news: news.map((n) => ({ ...n, publishedAt: n.publishedAt ?? row.updatedAt })),
    newsCount: newsCount[0]?.n ?? 0,
    donations: donations.map((d) => ({
      name: d.isAnonymous || !d.name.trim() ? "Hamba Allah" : d.name,
      prayer: d.prayer?.trim() ? d.prayer : null,
      amount: d.amount,
      timeLabel: d.paidAt ? formatRelativePast(d.paidAt, now) : "",
    })),
  };
}

/** Detail campaign publik (published/paused/completed). Draft/archived → null (404). */
export async function getPublicCampaignDetail(slug: string): Promise<CampaignDetail | null> {
  "use cache";
  cacheLife(ISR_LIFE);
  cacheTag(CAMPAIGNS_TAG, campaignTag(slug));
  return loadCampaignDetail(
    and(eq(campaigns.slug, slug), inArray(campaigns.status, [...PUBLIC_STATUSES]))!,
  );
}

/**
 * Pratinjau admin (token sah): status apa pun kecuali archived. TIDAK di-cache agar draft
 * tidak pernah masuk shell ISR publik.
 */
export async function getCampaignPreview(
  slug: string,
  campaignId: string,
): Promise<CampaignDetail | null> {
  return loadCampaignDetail(
    and(
      eq(campaigns.slug, slug),
      eq(campaigns.id, campaignId),
      sql`${campaigns.status} <> 'archived'`,
    )!,
  );
}

/** Berita published milik campaign publik tersebut; selain itu null (404). */
export async function getPublicNewsDetail(
  campaignSlug: string,
  newsSlug: string,
): Promise<NewsDetail | null> {
  "use cache";
  cacheLife(ISR_LIFE);
  cacheTag(CAMPAIGNS_TAG, campaignTag(campaignSlug));
  const db = getDb();
  const [row] = await db
    .select({
      slug: campaignNews.slug,
      title: campaignNews.title,
      excerpt: campaignNews.excerpt,
      contentHtml: campaignNews.contentHtml,
      imageUrl: campaignNews.featuredImageUrl,
      imageAlt: campaignNews.featuredImageAlt,
      seoTitle: campaignNews.seoTitle,
      seoDescription: campaignNews.seoDescription,
      publishedAt: campaignNews.publishedAt,
      updatedAt: campaignNews.updatedAt,
      campaignId: campaigns.id,
      campaignTitle: campaigns.title,
      campaignStatus: campaigns.status,
      campaignImageUrl: campaigns.featuredImageUrl,
      campaignImageAlt: campaigns.featuredImageAlt,
      targetAmount: campaigns.targetAmount,
      collectedAmount: campaigns.collectedAmount,
    })
    .from(campaignNews)
    .innerJoin(campaigns, eq(campaignNews.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.slug, campaignSlug),
        inArray(campaigns.status, [...PUBLIC_STATUSES]),
        eq(campaignNews.slug, newsSlug),
        eq(campaignNews.status, "published"),
        isNull(campaignNews.deletedAt),
      ),
    )
    .limit(1);
  if (!row || !row.publishedAt) return null;
  const others = await db
    .select({
      slug: campaignNews.slug,
      title: campaignNews.title,
      excerpt: campaignNews.excerpt,
      publishedAt: campaignNews.publishedAt,
    })
    .from(campaignNews)
    .where(and(publishedNews(row.campaignId), sql`${campaignNews.slug} <> ${newsSlug}`))
    .orderBy(desc(campaignNews.publishedAt))
    .limit(5);
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: sanitizeRichText(row.contentHtml),
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    campaign: {
      id: row.campaignId,
      slug: campaignSlug,
      title: row.campaignTitle,
      status: row.campaignStatus,
      imageUrl: row.campaignImageUrl ?? PLACEHOLDER,
      imageAlt: row.campaignImageAlt ?? row.campaignTitle,
      targetAmount: row.targetAmount,
      collectedAmount: row.collectedAmount,
    },
    otherNews: others.map((n) => ({ ...n, publishedAt: n.publishedAt ?? row.updatedAt })),
  };
}

/** Pasangan slug berita published terbaru (generateStaticParams). */
export async function getRecentNewsParams(limit = 50): Promise<{ slug: string; newsSlug: string }[]> {
  "use cache";
  cacheLife(ISR_LIFE);
  cacheTag(CAMPAIGNS_TAG);
  return getDb()
    .select({ slug: campaigns.slug, newsSlug: campaignNews.slug })
    .from(campaignNews)
    .innerJoin(campaigns, eq(campaignNews.campaignId, campaigns.id))
    .where(
      and(
        inArray(campaigns.status, [...PUBLIC_STATUSES]),
        eq(campaignNews.status, "published"),
        isNull(campaignNews.deletedAt),
      ),
    )
    .orderBy(desc(campaignNews.publishedAt))
    .limit(limit);
}
