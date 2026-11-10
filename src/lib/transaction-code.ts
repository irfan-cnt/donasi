import { randomInt } from "node:crypto";

/** Alfabet Crockford base32 (tanpa I, L, O, U). */
export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const TRANSACTION_CODE_PATTERN = /^TK-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/;

/** Tanggal YYMMDD menurut zona Asia/Jakarta. */
export function jakartaDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

/** Kode transaksi TK-YYMMDD-XXXXXX (6 karakter acak Crockford base32, CSPRNG). */
export function generateTransactionCode(now: Date = new Date()): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += CROCKFORD_ALPHABET[randomInt(32)];
  return `TK-${jakartaDateStamp(now)}-${suffix}`;
}

export function isTransactionCode(value: string): boolean {
  return TRANSACTION_CODE_PATTERN.test(value);
}
