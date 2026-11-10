import "server-only";
import { revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { forgetCampaignExistence } from "@/server/queries/public-route-exists";
import { CAMPAIGNS_TAG, campaignTag } from "@/server/queries/public-campaigns";

/**
 * Invalidasi cache publik setelah perubahan admin (P21): tag `campaigns` (listing, beranda,
 * sitemap) + `campaign:{slug}` (detail & berita), kedaluwarsa segera; plus memo 404 proxy.
 */
export function invalidateCampaignCaches(...slugs: (string | null | undefined)[]): void {
  const unique = [...new Set(slugs.filter((s): s is string => !!s))];
  try {
    revalidateTag(CAMPAIGNS_TAG, { expire: 0 });
    for (const slug of unique) revalidateTag(campaignTag(slug), { expire: 0 });
  } catch (error) {
    // Di luar konteks request Next (skrip) revalidateTag tidak tersedia; cache ISR 60 s jadi cadangan.
    logger.warn("revalidateTag gagal", { error: String(error) });
  }
  for (const slug of unique) forgetCampaignExistence(slug);
}
