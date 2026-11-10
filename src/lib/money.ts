/**
 * Uang = bigint rupiah (tanpa desimal). Jangan pakai `number` untuk nominal di server.
 */
export type Rupiah = bigint;

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Konversi aman ke bigint rupiah. Menolak pecahan, NaN, dan string non-digit. */
export function toRupiah(value: bigint | number | string): Rupiah {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RangeError("Nominal harus bilangan bulat aman");
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) throw new RangeError("Nominal harus berupa angka bulat");
  return BigInt(trimmed);
}

export function sumRupiah(values: readonly Rupiah[]): Rupiah {
  return values.reduce((acc, v) => acc + v, 0n);
}

/** Persentase progres (0–100, dibulatkan ke bawah) tanpa kehilangan presisi bigint. */
export function progressPercent(collected: Rupiah, target: Rupiah): number {
  if (target <= 0n) return 0;
  const pct = (collected * 100n) / target;
  return Number(pct > 100n ? 100n : pct < 0n ? 0n : pct);
}

/** Format "Rp 1.250.000" (id-ID). */
export function formatRupiah(value: Rupiah): string {
  return rupiahFormatter.format(value).replace(/ /g, " ");
}
