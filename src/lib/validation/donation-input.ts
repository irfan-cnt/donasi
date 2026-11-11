// Bagian murni (tanpa Zod) validasi checkout donasi: dipakai form klien (umpan balik inline)
// sehingga Zod tidak ikut ke bundle publik (P24, NFR-04). Server tetap memakai
// `parseDonationInput` di ./donation.ts sebagai sumber kebenaran.

export const MAX_AMOUNT_DIGITS = 13;
export const PRAYER_MAX = 280;
export const ANONYMOUS_NAME = "Hamba Allah";

/** Hanya digit, tanpa nol di depan, maksimal 13 digit (dipakai input nominal di klien). */
export function sanitizeAmountInput(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_AMOUNT_DIGITS);
}

const thousands = new Intl.NumberFormat("id-ID");

/** "1250000" → "1.250.000" via BigInt (presisi penuh). */
export function formatAmountDigits(digits: string): string {
  return /^\d+$/.test(digits) ? thousands.format(BigInt(digits)) : "";
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const rp = (v: bigint) => rupiah.format(v).replace(/ /g, " ");

export interface AmountBounds {
  min: bigint;
  max: bigint;
}

/** Pesan error nominal open (AC-04.1) atau null bila valid. `digits` = string mentah. */
export function amountError(digits: string, bounds: AmountBounds): string | null {
  const v = digits.trim();
  if (!v) return "Masukkan nominal donasi.";
  if (!/^\d+$/.test(v)) return "Nominal hanya boleh berisi angka.";
  if (v.length > MAX_AMOUNT_DIGITS) return `Nominal maksimal ${MAX_AMOUNT_DIGITS} digit.`;
  const amount = BigInt(v);
  if (amount < bounds.min) return `Minimal donasi ${rp(bounds.min)}.`;
  if (amount > bounds.max) return `Maksimal donasi ${rp(bounds.max)} per transaksi.`;
  return null;
}

/** Normalisasi nomor WA Indonesia ke E.164 (+62…); null bila tidak valid. */
export function normalizeIndonesianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "");
  let rest: string | null = null;
  if (/^\+62\d+$/.test(digits)) rest = digits.slice(3);
  else if (/^62\d+$/.test(digits)) rest = digits.slice(2);
  else if (/^0\d+$/.test(digits)) rest = digits.slice(1);
  if (!rest || !/^8\d{7,12}$/.test(rest)) return null;
  return `+62${rest}`;
}

export type DonationFieldErrors = Partial<Record<"amount" | "optionId" | "name" | "email" | "phone" | "prayer" | "form", string>>;
