export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const rupiahFmt = new Intl.NumberFormat('id-ID');
/** Format rupiah. Mockup memakai number; produksi memakai bigint di server. */
export function rupiah(n: number): string {
  return `Rp${rupiahFmt.format(n)}`;
}

export function percent(collected: number, target?: number | null): number {
  if (!target) return 0;
  return Math.min(100, Math.round((collected / target) * 100));
}

/** Input nominal: hanya digit, maksimal 13 digit (≤ Rp9,9 triliun) — mencegah kehilangan presisi. */
export function sanitizeAmountInput(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);
}

export function formatThousands(digits: string): string {
  return digits ? rupiahFmt.format(Number(digits)) : '';
}

/** Format ringkas untuk kartu KPI: Rp868,8 jt / Rp1,2 M */
export function rupiahCompact(n: number): string {
  if (n >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  return rupiah(n);
}
