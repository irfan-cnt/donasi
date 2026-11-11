import { isIP } from "node:net";

/**
 * IP klien (P25, I1) — satu sumber untuk rate limit, audit, dan hash IP. Urutan: header platform
 * Vercel `x-vercel-forwarded-for` (tidak bisa ditimpa klien di Vercel), lalu entri PERTAMA
 * `x-forwarded-for` (Vercel menimpa header ini; di luar Vercel bisa dipalsukan — lihat
 * security.md), lalu `x-real-ip`. Nilai yang bukan IP valid → null (pemanggil memakai bucket
 * "unknown").
 */
export function clientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim(),
    headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    headers.get("x-real-ip")?.trim(),
  ];
  const ip = candidates.find((c) => !!c);
  return ip && isIP(ip) ? ip : null;
}
