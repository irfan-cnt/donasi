/**
 * Aturan indeks mesin pencari (P24, NFR-15). Dipakai robots.ts, metadata root dan header
 * `X-Robots-Tag` di next.config.ts agar ketiganya tidak pernah berbeda.
 */

/** Hanya deployment production yang boleh diindeks; preview/development selalu noindex. */
export function isIndexable(appEnv: string | undefined = process.env.APP_ENV): boolean {
  return appEnv === "production";
}

/**
 * Prefix privat yang diblokir di robots.txt. `/donasi/*\/pembayaran` memakai wildcard robots
 * (didukung Google/Bing); halaman checkout `/donasi/[slug]` sendiri tetap noindex lewat meta.
 */
export const ROBOTS_DISALLOW = [
  "/admin",
  "/akun",
  "/transaksi",
  "/donasi/*/pembayaran",
  "/api",
] as const;

/**
 * Pola path (sintaks `headers()` Next) yang selalu dikirim dengan `X-Robots-Tag: noindex`:
 * lapisan kedua di samping meta robots tiap halaman, juga berlaku untuk respons non-HTML
 * (redirect, 404 proxy) di bawah prefix ini.
 */
export const NOINDEX_PATH_PATTERNS = [
  "/admin/:path*",
  "/akun/:path*",
  "/transaksi/:path*",
  "/donasi/:path*",
  "/masuk",
  "/api/:path*",
] as const;

export const NOINDEX_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" } as const;

/** Header `X-Robots-Tag` untuk next.config `headers()`. Non-production: seluruh situs. */
export function robotsHeaderRules(appEnv: string | undefined = process.env.APP_ENV) {
  const sources: readonly string[] = isIndexable(appEnv) ? NOINDEX_PATH_PATTERNS : ["/:path*"];
  return sources.map((source) => ({ source, headers: [NOINDEX_HEADER] }));
}
