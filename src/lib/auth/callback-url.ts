/** Tujuan default setelah login donatur. */
export const DEFAULT_DONOR_CALLBACK = "/akun";

const DUMMY_ORIGIN = "http://internal.invalid";

/**
 * Sanitasi `callbackUrl` (cegah open redirect — AC-09.3).
 * Hanya path relatif internal (`/…`) yang diterima; selain itu → `fallback`.
 * Fungsi murni: aman dipakai di server maupun test.
 */
export function sanitizeCallbackUrl(
  value: unknown,
  fallback: string = DEFAULT_DONOR_CALLBACK,
): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 2048) return fallback;
  // Wajib diawali satu "/" — tolak "//host", "/\host", skema, dan path relatif polos.
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Backslash & karakter kontrol bisa dinormalisasi browser menjadi "//host".
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, DUMMY_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== DUMMY_ORIGIN) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  // Normalisasi dot-segment ("/.//host") bisa menghasilkan "//host" lagi.
  if (path.startsWith("//")) return fallback;
  // Hindari loop kembali ke halaman login atau endpoint auth.
  if (/^\/(masuk|api\/auth)(\/|\?|#|$)/.test(path)) return fallback;
  return path;
}
