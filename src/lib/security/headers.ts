/**
 * Header keamanan (P25, T-45; security.md §5). Modul murni (tanpa secret, tanpa I/O): dipakai
 * `next.config.ts` (header statis untuk SEMUA respons, termasuk aset & API) dan `src/proxy.ts`
 * (CSP ber-nonce per permintaan). Diuji di tests/unit/security-headers.test.ts.
 */

export type HeaderEnv = {
  APP_ENV?: string;
  APP_URL?: string;
  NODE_ENV?: string;
  /** Host store Vercel Blob proyek (lihat blob-host.ts); null = belum diketahui. */
  blobHost?: string | null;
};

/** Origin aplikasi dari APP_URL (tanpa path); null bila tidak valid. */
export function appOrigin(appUrl: string | undefined): URL | null {
  try {
    return appUrl ? new URL(appUrl) : null;
  } catch {
    return null;
  }
}

/** Nonce 128-bit acak per permintaan (base64). Web Crypto: berjalan di runtime proxy. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Script inline konstan React DOM (Fizz) di shell prerender `cacheComponents`: dikirim TANPA
 * nonce karena shell dibuat saat build. Diizinkan lewat hash; test unit memastikan string ini
 * masih persis ada di react-dom terpasang (upgrade React yang mengubahnya akan gagal test).
 */
export const REACT_SHELL_INLINE_SCRIPTS = ["requestAnimationFrame(function(){$RT=performance.now()});"] as const;
export const REACT_SHELL_SCRIPT_HASHES = ["'sha256-7mu4H06fwDCjmnxxr/xNHyuQC6pLTHr4M2E4jXw5WZs='"] as const;

/**
 * Content-Security-Policy. Script: `'self'` + nonce per permintaan + hash script shell React.
 * TANPA 'strict-dynamic': shell PPR (`cacheComponents`) memuat chunk `/_next/static` tanpa
 * nonce, jadi 'strict-dynamic' (yang mengabaikan 'self') mematikan hidrasi semua halaman —
 * terverifikasi P25. Tanpa 'unsafe-inline'; 'unsafe-eval' HANYA di `next dev`.
 * Style: 'unsafe-inline' (atribut style={} hasil SSR — progress bar, Recharts — tidak bisa
 * diberi nonce; risiko injeksi CSS jauh lebih rendah dari script; OD-27).
 */
export function buildCsp(nonce: string, env: HeaderEnv): string {
  const dev = env.NODE_ENV === "development";
  const https = appOrigin(env.APP_URL)?.protocol === "https:";
  // Gambar Blob: host store proyek saja; wildcard hanya di APP_ENV=development (sama seperti
  // images.remotePatterns di next.config.ts).
  const blob = env.blobHost
    ? `https://${env.blobHost}`
    : (env.APP_ENV ?? "development") === "development"
      ? "https://*.public.blob.vercel-storage.com"
      : "";
  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", `'self' 'nonce-${nonce}' ${REACT_SHELL_SCRIPT_HASHES.join(" ")}${dev ? " 'unsafe-eval'" : ""}`],
    ["style-src", "'self' 'unsafe-inline'"],
    // data: = QR (QRIS/e-wallet) dan placeholder next/image; blob: = pratinjau upload admin.
    ["img-src", `'self' data: blob:${blob ? ` ${blob}` : ""}`],
    ["font-src", "'self'"],
    // Speed Insights & vitals same-origin (/_vercel/*); ws: hanya untuk HMR `next dev`.
    ["connect-src", `'self'${dev ? " ws: wss:" : ""}`],
    ["frame-src", "'self'"],
    ["media-src", "'self'"],
    ["manifest-src", "'self'"],
    ["worker-src", "'self' blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    // Login Google: form POST ke /api/auth/signin/google lalu 302 ke accounts.google.com —
    // Chrome menerapkan form-action pada redirect. Midtrans (Core API) tidak memakai form.
    ["form-action", "'self' https://accounts.google.com"],
    ["frame-ancestors", "'none'"],
  ];
  const parts = directives.map(([k, v]) => `${k} ${v}`);
  if (https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** HSTS hanya di production berprotokol https (localhost http & preview tidak terpengaruh). */
export function hstsValue(env: HeaderEnv): string | null {
  if (env.APP_ENV !== "production") return null;
  if (appOrigin(env.APP_URL)?.protocol !== "https:") return null;
  // 1 tahun. includeSubDomains/preload = keputusan PM (OD-27) setelah domain stabil.
  return "max-age=31536000";
}

export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), " +
  "magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=()";

/** Header statis untuk next.config `headers()` — berlaku untuk semua path. */
export function staticSecurityHeaders(env: HeaderEnv): { key: string; value: string }[] {
  const headers = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  const hsts = hstsValue(env);
  if (hsts) headers.push({ key: "Strict-Transport-Security", value: hsts });
  return headers;
}

/**
 * Halaman yang membawa access token transaksi di URL (`?t=`): Referer tidak dikirim sama
 * sekali, termasuk same-origin (security.md §3).
 */
export function isTokenBearingPath(pathname: string): boolean {
  return pathname.startsWith("/transaksi/") || /^\/donasi\/[^/]+\/pembayaran\/?$/.test(pathname);
}

/** CSP untuk respons non-HTML (API/JSON): tidak memuat apa pun dan tidak boleh di-frame. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
