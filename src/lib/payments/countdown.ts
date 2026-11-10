// Hitung mundur instruksi pembayaran (murni; dipakai server & client).

export interface Remaining {
  expired: boolean;
  totalSeconds: number;
  /** "HH:MM:SS" (jam bisa > 24). */
  label: string;
}

export function remainingUntil(expiresAt: Date | string | number, now: Date | number): Remaining {
  const end = new Date(expiresAt).getTime();
  const current = typeof now === "number" ? now : now.getTime();
  if (!Number.isFinite(end)) return { expired: true, totalSeconds: 0, label: "00:00:00" };
  const totalSeconds = Math.max(0, Math.floor((end - current) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    expired: totalSeconds === 0,
    totalSeconds,
    label: [h, m, s].map((v) => String(v).padStart(2, "0")).join(":"),
  };
}

/** Polling status (AC-08.1): tiap 5 s, maksimal 10 menit. */
export const POLL_INTERVAL_MS = 5_000;
export const POLL_MAX_MS = 10 * 60_000;
