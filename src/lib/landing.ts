/**
 * Konstanta landing page `/` (P30, marketing/landing-page-implementation-brief.md).
 */

/**
 * Ambang tampil angka statistik (S2, LP-AC-05): di bawah ambang, strip statistik menampilkan
 * tiga fakta produk statis, bukan "Rp0 / 0 / 0". Nilai awal 1 donasi paid (contoh di brief);
 * PM dapat menaikkannya di sini.
 */
export const STATS_MIN_PAID_DONATIONS = 1;

export function showPlatformStats(paidDonations: number, min: number = STATS_MIN_PAID_DONATIONS): boolean {
  return paidDonations >= Math.max(1, min);
}

export const STATIC_TRUST_FACTS = ["Tanpa wajib daftar", "Kuitansi otomatis", "Rincian dana terbuka"] as const;

/**
 * Blok legalitas lembaga (S6, LP-AC-09). `null` = tidak dirender sampai OD-02 diputuskan dan
 * dokumen tersedia. Isi dengan teks final (tanpa placeholder) untuk menampilkannya.
 */
export const LEGALITY_BLOCK: { title: string; body: string } | null = null;

/**
 * Kalimat biaya operasional di S5 (OD-05). `null` = tidak dirender sampai diputuskan.
 */
export const OPERATIONAL_FEE_SENTENCE: string | null = null;
