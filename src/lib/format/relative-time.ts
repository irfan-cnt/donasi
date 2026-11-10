/**
 * Waktu relatif Bahasa Indonesia untuk waktu LAMPAU (daftar donatur, AC-02.5).
 * Murni & deterministik: `now` wajib diberikan pemanggil. Batas "kemarin"/"N hari lalu" dihitung
 * dari tanggal kalender Asia/Jakarta, bukan selisih 24 jam. Waktu di masa depan (clock skew)
 * tidak pernah menghasilkan "dari sekarang" — dianggap "baru saja".
 */
const TZ = "Asia/Jakarta";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const absoluteFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Nomor hari kalender di Asia/Jakarta (hari sejak epoch). */
function jakartaDayNumber(d: Date): number {
  const [y, m, day] = dayKeyFormatter.format(d).split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, day!) / 86_400_000);
}

export function formatRelativePast(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "baru saja";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} menit lalu`;
  const days = jakartaDayNumber(now) - jakartaDayNumber(date);
  if (days <= 0) return `${Math.floor(diff / HOUR)} jam lalu`;
  if (days === 1) return "kemarin";
  if (days < 30) return `${days} hari lalu`;
  return absoluteFormatter.format(date);
}

/** Tanggal pendek Asia/Jakarta, mis. "18 Okt 2026". */
export function formatDateJakarta(date: Date): string {
  return absoluteFormatter.format(date);
}
