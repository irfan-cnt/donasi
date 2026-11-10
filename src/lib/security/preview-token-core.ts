import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token pratinjau campaign draft untuk admin (P07; UI pembuatnya di P21).
 * Format: `<campaignId>.<expUnixSec>.<hmac-sha256 base64url>`; kunci diturunkan dari
 * AUTH_SECRET dengan label domain agar tidak bisa dipakai ulang untuk tujuan lain.
 * Fungsi murni (secret diberikan pemanggil) — tanpa `server-only` agar bisa diuji/dipakai helper
 * e2e; pembacaan secret ada di preview-token.ts (server-only).
 */
export const PREVIEW_TTL_SECONDS = 60 * 60;
const LABEL = "tk:campaign-preview:v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function mac(secret: string, payload: string): Buffer {
  const key = createHmac("sha256", secret).update(LABEL).digest();
  return createHmac("sha256", key).update(payload).digest();
}

export function signPreviewToken(
  campaignId: string,
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = PREVIEW_TTL_SECONDS,
): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = `${campaignId}.${exp}`;
  return `${payload}.${mac(secret, payload).toString("base64url")}`;
}

/** Mengembalikan campaignId bila token sah & belum kedaluwarsa; selain itu null. */
export function verifyPreviewToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): string | null {
  if (token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [campaignId, expRaw, sig] = parts as [string, string, string];
  if (!UUID_RE.test(campaignId) || !/^\d{1,12}$/.test(expRaw)) return null;
  const expected = mac(secret, `${campaignId}.${expRaw}`);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(expRaw) * 1000 <= nowMs) return null;
  return campaignId;
}
