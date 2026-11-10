/** URL kanonik situs (metadataBase, sitemap, robots). Tanpa trailing slash. */
export function siteUrl(): string {
  const raw = process.env.APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const SITE_NAME = "Tebar Kebaikan";
