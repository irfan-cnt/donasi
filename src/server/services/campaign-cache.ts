import "server-only";
import { revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { invalidateCache } from "@/lib/redis/cache";
import { forgetCampaignExistence } from "@/server/queries/public-route-exists";
import { CAMPAIGNS_TAG, FEATURED_CACHE_KEY, campaignTag } from "@/server/queries/public-campaigns";
import { safeError } from "@/lib/safe-error";

/**
 * Invalidasi cache publik setelah perubahan admin (P21): tag `campaigns` (listing, beranda,
 * sitemap) + `campaign:{slug}` (detail & berita), kedaluwarsa segera; plus memo 404 proxy dan
 * entri Redis kartu campaign pilihan (P24) agar tidak menyajikan ulang data lama.
 */
export async function invalidateCampaignCaches(
  ...slugs: (string | null | undefined)[]
): Promise<void> {
  const unique = [...new Set(slugs.filter((s): s is string => !!s))];
  try {
    revalidateTag(CAMPAIGNS_TAG, { expire: 0 });
    for (const slug of unique) revalidateTag(campaignTag(slug), { expire: 0 });
  } catch (error) {
    // Di luar konteks request Next (skrip) revalidateTag tidak tersedia; cache ISR 60 s jadi cadangan.
    logger.warn("revalidateTag gagal", { error: safeError(error) });
  }
  for (const slug of unique) forgetCampaignExistence(slug);
  await invalidateCache(FEATURED_CACHE_KEY);
}
