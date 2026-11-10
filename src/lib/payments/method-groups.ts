// Pengelompokan & penyaringan metode pembayaran untuk halaman Select Payment (F-05). Murni.
import type { MethodType } from "./types";

export interface AvailableMethod {
  id: string;
  code: string;
  type: MethodType;
  displayName: string;
  logoUrl: string | null;
  minAmount: bigint;
  maxAmount: bigint | null;
  expiryMinutes: number;
  displayOrder: number;
}

export type MethodGroupKey = "qris" | "ewallet" | "virtual_account";

export interface MethodGroup {
  key: MethodGroupKey;
  title: string;
  hint: string;
  methods: AvailableMethod[];
}

const GROUPS: { key: MethodGroupKey; title: string; hint: string }[] = [
  { key: "qris", title: "QRIS", hint: "Bayar dari aplikasi bank atau e-wallet apa pun" },
  { key: "ewallet", title: "E-Wallet", hint: "Diarahkan ke aplikasi e-wallet" },
  {
    key: "virtual_account",
    title: "Virtual Account",
    hint: "Transfer bank, terverifikasi otomatis",
  },
];

/** Metode mendukung nominal bila min ≤ amount ≤ max (max kosong = tanpa batas). */
export function supportsAmount(m: Pick<AvailableMethod, "minAmount" | "maxAmount">, amount: bigint) {
  return amount >= m.minAmount && (m.maxAmount === null || amount <= m.maxAmount);
}

/**
 * Kelompokkan QRIS / E-Wallet / Virtual Account (urut display_order), buang metode yang tidak
 * mendukung nominal dan tipe di luar MVP (retail/card). Grup kosong tidak dikembalikan.
 */
export function groupMethods(methods: AvailableMethod[], amount: bigint): MethodGroup[] {
  const usable = methods
    .filter((m) => supportsAmount(m, amount))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  return GROUPS.map((g) => ({ ...g, methods: usable.filter((m) => m.type === g.key) })).filter(
    (g) => g.methods.length > 0,
  );
}

/** Label masa berlaku ramah (mis. "15 menit", "24 jam", "2 hari"). */
export function expiryLabel(minutes: number): string {
  if (minutes % 1440 === 0 && minutes >= 2880) return `${minutes / 1440} hari`;
  if (minutes % 60 === 0) return `${minutes / 60} jam`;
  return `${minutes} menit`;
}
