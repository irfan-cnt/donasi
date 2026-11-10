import { z } from "zod";

/** Ukuran halaman daftar campaign publik (Home & /campaign). */
export const CAMPAIGN_PAGE_SIZE = 6;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const categorySlugSchema = z.string().trim().toLowerCase().max(64).regex(SLUG_RE);

/**
 * Ambil `?kategori=` dari searchParams. Hanya slug yang ada di `validSlugs` yang diterima;
 * nilai lain (tidak valid, array, kosong) diabaikan → `undefined` (= semua kategori).
 */
export function parseCategoryParam(
  raw: string | string[] | undefined,
  validSlugs: readonly string[],
): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = categorySlugSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return validSlugs.includes(parsed.data) ? parsed.data : undefined;
}

/** Posisi keyset: urutan `published_at DESC, id DESC`. */
export interface CampaignCursor {
  publishedAt: Date;
  id: string;
}

export function encodeCursor(cursor: CampaignCursor): string {
  return Buffer.from(`${cursor.publishedAt.toISOString()}|${cursor.id}`, "utf8").toString(
    "base64url",
  );
}

const cursorStringSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);

/** Decode cursor opak; `null` bila rusak/dimanipulasi. */
export function decodeCursor(raw: unknown): CampaignCursor | null {
  const parsed = cursorStringSchema.safeParse(raw);
  if (!parsed.success) return null;
  const decoded = Buffer.from(parsed.data, "base64url").toString("utf8");
  const [iso, id, ...rest] = decoded.split("|");
  if (!iso || !id || rest.length > 0 || !UUID_RE.test(id)) return null;
  const publishedAt = new Date(iso);
  if (Number.isNaN(publishedAt.getTime()) || publishedAt.toISOString() !== iso) return null;
  return { publishedAt, id: id.toLowerCase() };
}

/** Input server action "Muat lebih banyak". */
export const loadMoreInputSchema = z.object({
  status: z.enum(["published", "completed"]).default("published"),
  kategori: categorySlugSchema.optional(),
  cursor: cursorStringSchema,
});
