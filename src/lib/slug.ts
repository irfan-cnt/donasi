const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Normalisasi segmen slug dari URL: decode, trim, huruf kecil. Slug kanonik di DB selalu
 * huruf kecil (CHECK campaigns_slug_check), jadi hasil ini = slug kanonik bila valid.
 * Mengembalikan null bila tidak bisa menjadi slug valid.
 */
export function normalizeSlug(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const slug = decoded.trim().toLowerCase();
  return SLUG_RE.test(slug) && slug.length <= 200 ? slug : null;
}
