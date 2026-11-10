"use server";

import { decodeCursor, loadMoreInputSchema } from "@/lib/validation/campaign-list";
import {
  getCampaignPage,
  getPublicCategories,
  type CampaignPage,
} from "@/server/queries/public-campaigns";

/** "Muat lebih banyak" (keyset). Publik & read-only; input divalidasi Zod. */
export async function loadMoreCampaigns(input: unknown): Promise<CampaignPage> {
  const parsed = loadMoreInputSchema.safeParse(input);
  if (!parsed.success) return { items: [], nextCursor: null };
  const { status, kategori, cursor } = parsed.data;
  if (!decodeCursor(cursor)) return { items: [], nextCursor: null };
  const categories = await getPublicCategories();
  const categorySlug = kategori && categories.some((c) => c.slug === kategori) ? kategori : undefined;
  return getCampaignPage({ status, categorySlug, cursor });
}
