import { createHmac, timingSafeEqual } from "node:crypto";

// Tautan unduh ekspor CSV async (P22). Format: `<kind>.<m|u>.<exportId>.<adminId>.<expUnixSec>.<hmac>`
// (`m` = berkas dimasking, `u` = PII penuh → unduh butuh donors.export saat itu juga).
// Kunci diturunkan dari AUTH_SECRET dengan label domain (tidak bisa dipakai ulang untuk token
// lain). Terikat ke admin peminta: route unduh tetap memeriksa sesi admin + permission dan
// mencocokkan adminId sesi. Modul murni (secret diberikan pemanggil).

export const EXPORT_LINK_TTL_SECONDS = 60 * 60;
export const EXPORT_KINDS = ["transactions", "donors"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

const LABEL = "tk:admin-export:v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function mac(secret: string, payload: string): Buffer {
  const key = createHmac("sha256", secret).update(LABEL).digest();
  return createHmac("sha256", key).update(payload).digest();
}

export interface ExportTokenClaims {
  kind: ExportKind;
  /** true = berkas berisi email/WA tersamar. */
  masked: boolean;
  exportId: string;
  adminId: string;
  expiresAt: Date;
}

export function signExportToken(
  claims: { kind: ExportKind; masked: boolean; exportId: string; adminId: string },
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = EXPORT_LINK_TTL_SECONDS,
): string {
  const payload = `${claims.kind}.${claims.masked ? "m" : "u"}.${claims.exportId}.${claims.adminId}.${Math.floor(nowMs / 1000) + ttlSeconds}`;
  return `${payload}.${mac(secret, payload).toString("base64url")}`;
}

/** Klaim bila tanda tangan sah & belum kedaluwarsa; selain itu null. */
export function verifyExportToken(token: string, secret: string, nowMs: number = Date.now()): ExportTokenClaims | null {
  if (token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 6) return null;
  const [kind, m, exportId, adminId, expRaw, sig] = parts as [string, string, string, string, string, string];
  if (!(EXPORT_KINDS as readonly string[]).includes(kind) || (m !== "m" && m !== "u")) return null;
  if (!UUID_RE.test(exportId) || !UUID_RE.test(adminId) || !/^\d{1,12}$/.test(expRaw)) return null;
  const expected = mac(secret, `${kind}.${m}.${exportId}.${adminId}.${expRaw}`);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const exp = Number(expRaw) * 1000;
  if (exp <= nowMs) return null;
  return { kind: kind as ExportKind, masked: m === "m", exportId, adminId, expiresAt: new Date(exp) };
}
