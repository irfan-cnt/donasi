import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/lib/db";
import { campaignCategories, campaignNews, campaigns, transactions } from "@/lib/db/schema";
import { cachedJson } from "@/lib/redis/cache";
import {
  CAMPAIGN_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  type CampaignCursor,
} from "@/lib/validation/campaign-list";

// Data publik saja: tidak ada kolom donor/PII. Semua fungsi `"use cache"` → masuk ke shell
// ISR (revalidate 60 s) dengan tag `campaigns` + `campaign:{slug}` (system-architecture.md).

export const CAMPAIGNS_TAG = "campaigns";
export const campaignTag = (slug: string) => `campaign:${slug}`;

const ISR_LIFE = { stale: 60, revalidate: 60, expire: 3600 } as const;

export interface PublicCategory {
  slug: string;
  name: string;
  icon: string | null;
}

export interface CampaignCardData {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  categorySlug: string;
  categoryName: string;
  categoryIcon: string | null;
  targetAmount: bigint | null;
  collectedAmount: bigint;
  donorCount: number;
  status: "published" | "completed";
  /** Sisa hari (dibulatkan ke atas) dihitung DB pada saat render ISR; null = tanpa batas. */
  daysLeft: number | null;
}

export interface CampaignPage {
  items: CampaignCardData[];
  nextCursor: string | null;
}

export interface PlatformStats {
  collectedAmount: bigint;
  paidDonations: number;
  publishedNews: number;
}

const cardColumns = {
  id: campaigns.id,
  slug: campaigns.slug,
  title: campaigns.title,
  imageUrl: campaigns.featuredImageUrl,
  imageAlt: campaigns.featuredImageAlt,
  categorySlug: campaignCategories.slug,
  categoryName: campaignCategories.name,
  categoryIcon: campaignCategories.icon,
  targetAmount: campaigns.targetAmount,
  collectedAmount: campaigns.collectedAmount,
  donorCount: campaigns.donorCount,
  status: campaigns.status,
  publishedAt: campaigns.publishedAt,
  daysLeft: sql<
    number | null
  >`case when ${campaigns.endAt} is null then null else greatest(0, ceil(extract(epoch from (${campaigns.endAt} - now())) / 86400))::int end`,
};

type CardRow = Awaited<ReturnType<typeof baseSelect>>[number];

function toCard(row: CardRow): CampaignCardData {
  // published/completed wajib punya gambar + alt (CHECK published_requires_image).
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    imageUrl: row.imageUrl ?? "/images/sample/placeholder.svg",
    imageAlt: row.imageAlt ?? row.title,
    categorySlug: row.categorySlug,
    categoryName: row.categoryName,
    categoryIcon: row.categoryIcon,
    targetAmount: row.targetAmount,
    collectedAmount: row.collectedAmount,
    donorCount: row.donorCount,
    status: row.status === "completed" ? "completed" : "published",
    daysLeft: row.status === "completed" ? null : row.daysLeft,
  };
}

function tagCards(items: readonly { slug: string }[]) {
  cacheTag(CAMPAIGNS_TAG, ...items.map((c) => campaignTag(c.slug)));
}

function baseSelect() {
  return getDb()
    .select(cardColumns)
    .from(campaigns)
    .innerJoin(campaignCategories, eq(campaigns.categoryId, campaignCategories.id));
}

/** Kategori aktif (cache Redis 1 jam + "use cache" 1 jam). */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
  cacheTag("categories");
  return cachedJson(
    "categories:v1",
    3600,
    () =>
      getDb()
        .select({
          slug: campaignCategories.slug,
          name: campaignCategories.name,
          icon: campaignCategories.icon,
        })
        .from(campaignCategories)
        .where(eq(campaignCategories.isActive, true))
        .orderBy(asc(campaignCategories.sortOrder), asc(campaignCategories.name)),
    { serialize: (v) => v, deserialize: (raw) => raw as PublicCategory[] },
  );
}

/** Statistik platform (cache Redis 5 menit). Hanya agregat, tanpa data donor. */
export async function getPlatformStats(): Promise<PlatformStats> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag(CAMPAIGNS_TAG, "platform-stats");
  return cachedJson(
    "platform-stats:v1",
    300,
    async () => {
      const db = getDb();
      const [collected, paid, news] = await Promise.all([
        db
          .select({ total: sql<string>`coalesce(sum(${campaigns.collectedAmount}), 0)::text` })
          .from(campaigns)
          .where(inArray(campaigns.status, ["published", "paused", "completed"])),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(transactions)
          .where(eq(transactions.status, "paid")),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(campaignNews)
          .where(
            and(
              eq(campaignNews.status, "published"),
              sql`${campaignNews.deletedAt} is null`,
            ),
          ),
      ]);
      return {
        collectedAmount: BigInt(collected[0]?.total ?? "0"),
        paidDonations: paid[0]?.n ?? 0,
        publishedNews: news[0]?.n ?? 0,
      };
    },
    {
      serialize: (v) => ({ ...v, collectedAmount: v.collectedAmount.toString() }),
      deserialize: (raw) => {
        const r = raw as { collectedAmount: string; paidDonations: number; publishedNews: number };
        return { ...r, collectedAmount: BigInt(r.collectedAmount) };
      },
    },
  );
}

/** Kunci Redis kartu campaign pilihan (konstanta: tidak bergantung input request). */
export const FEATURED_CACHE_KEY = "featured:v1";
/** TTL Redis kartu pilihan (performance.md §3: 60 s). */
export const FEATURED_CACHE_TTL_S = 60;

type CardJson = Omit<CampaignCardData, "targetAmount" | "collectedAmount"> & {
  targetAmount: string | null;
  collectedAmount: string;
};

/** Codec bigint ↔ string untuk kartu campaign di Redis. */
export const featuredCodec = {
  serialize: (v: CampaignCardData | null): CardJson | null =>
    v && {
      ...v,
      targetAmount: v.targetAmount === null ? null : v.targetAmount.toString(),
      collectedAmount: v.collectedAmount.toString(),
    },
  deserialize: (raw: unknown): CampaignCardData | null => {
    const r = raw as CardJson | null;
    return (
      r && {
        ...r,
        targetAmount: r.targetAmount === null ? null : BigInt(r.targetAmount),
        collectedAmount: BigInt(r.collectedAmount),
      }
    );
  },
};

/**
 * Campaign pilihan untuk hero: is_featured terbaru, fallback published terbaru. Cache Redis 60 s
 * (dibagi antar instance) di bawah "use cache"; dihapus saat admin mengubah campaign dan saat
 * revalidasi `campaigns` setelah pembayaran (ter-throttle).
 */
export async function getFeaturedCampaign(): Promise<CampaignCardData | null> {
  "use cache";
  cacheLife(ISR_LIFE);
  const item = await cachedJson(
    FEATURED_CACHE_KEY,
    FEATURED_CACHE_TTL_S,
    async () => {
      const rows = await baseSelect()
        .where(eq(campaigns.status, "published"))
        .orderBy(desc(campaigns.isFeatured), desc(campaigns.publishedAt), desc(campaigns.id))
        .limit(1);
      return rows.map(toCard)[0] ?? null;
    },
    featuredCodec,
  );
  tagCards(item ? [item] : []);
  return item;
}

/** "Butuh bantuan segera": published dengan end_at terdekat yang belum lewat. */
export async function getUrgentCampaigns(limit = 3): Promise<CampaignCardData[]> {
  "use cache";
  cacheLife(ISR_LIFE);
  const rows = await baseSelect()
    .where(
      and(
        eq(campaigns.status, "published"),
        isNotNull(campaigns.endAt),
        sql`${campaigns.endAt} > now()`,
      ),
    )
    .orderBy(asc(campaigns.endAt), desc(campaigns.id))
    .limit(limit);
  const items = rows.map(toCard);
  tagCards(items);
  return items;
}

// Presisi Postgres = mikrodetik, JS Date = milidetik → bandingkan & urutkan pada milidetik
// agar cursor tidak melompati/menggandakan baris.
const publishedMs = sql<Date>`date_trunc('milliseconds', ${campaigns.publishedAt})`;

function keysetWhere(cursor: CampaignCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  const at = cursor.publishedAt.toISOString();
  return or(
    sql`${publishedMs} < ${at}::timestamptz`,
    and(sql`${publishedMs} = ${at}::timestamptz`, lt(campaigns.id, cursor.id)),
  );
}

/**
 * Satu halaman campaign (keyset `published_at DESC, id DESC`).
 * `cursor` = string opak dari `nextCursor`; cursor rusak diperlakukan sebagai halaman pertama.
 */
export async function getCampaignPage(options: {
  status: "published" | "completed";
  categorySlug?: string;
  cursor?: string;
  limit?: number;
}): Promise<CampaignPage> {
  "use cache";
  cacheLife(ISR_LIFE);
  const limit = Math.min(Math.max(options.limit ?? CAMPAIGN_PAGE_SIZE, 1), 24);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  const rows = await baseSelect()
    .where(
      and(
        eq(campaigns.status, options.status),
        isNotNull(campaigns.publishedAt),
        options.categorySlug ? eq(campaignCategories.slug, options.categorySlug) : undefined,
        keysetWhere(cursor),
      ),
    )
    .orderBy(desc(publishedMs), desc(campaigns.id))
    .limit(limit + 1);
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  const nextCursor =
    rows.length > limit && last?.publishedAt
      ? encodeCursor({ publishedAt: last.publishedAt, id: last.id })
      : null;
  const items = pageRows.map(toCard);
  tagCards(items);
  return { items, nextCursor };
}

/** Slug campaign publik untuk sitemap. */
export async function getSitemapCampaigns(): Promise<{ slug: string; updatedAt: Date }[]> {
  "use cache";
  cacheLife(ISR_LIFE);
  cacheTag(CAMPAIGNS_TAG);
  return getDb()
    .select({ slug: campaigns.slug, updatedAt: campaigns.updatedAt })
    .from(campaigns)
    .where(inArray(campaigns.status, ["published", "completed"]))
    .orderBy(desc(campaigns.publishedAt));
}

/**
 * Berita published (tidak terhapus) dari campaign yang tampil di sitemap (published/completed).
 * Draft, berita terhapus, dan campaign draft/paused/archived tidak pernah masuk (P24).
 */
export async function getSitemapNews(): Promise<
  { slug: string; newsSlug: string; updatedAt: Date }[]
> {
  "use cache";
  cacheLife(ISR_LIFE);
  cacheTag(CAMPAIGNS_TAG);
  return getDb()
    .select({ slug: campaigns.slug, newsSlug: campaignNews.slug, updatedAt: campaignNews.updatedAt })
    .from(campaignNews)
    .innerJoin(campaigns, eq(campaignNews.campaignId, campaigns.id))
    .where(
      and(
        inArray(campaigns.status, ["published", "completed"]),
        eq(campaignNews.status, "published"),
        isNull(campaignNews.deletedAt),
      ),
    )
    .orderBy(desc(campaignNews.publishedAt));
}
