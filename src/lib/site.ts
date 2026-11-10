/** URL kanonik situs (metadataBase, sitemap, robots). Tanpa trailing slash. */
export function siteUrl(): string {
  const raw = process.env.APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const SITE_NAME = "Tebar Kebaikan";

/** Warna tema (manifest, bilah browser) = hijau logo (--tk-primary). */
export const THEME_COLOR = "#086828";

/** OG default (scripts/brand-assets.ts) — fallback bila halaman tidak punya gambar sendiri. */
export const DEFAULT_OG_IMAGE = {
  url: "/brand/og-default.png",
  width: 1200,
  height: 630,
  alt: SITE_NAME,
} as const;
