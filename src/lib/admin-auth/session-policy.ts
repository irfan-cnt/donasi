// Kebijakan sesi admin (security.md §2) — murni, mudah diuji.
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ADMIN_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
/** Batasi penulisan last_seen_at: paling sering sekali per menit. */
export const ADMIN_TOUCH_INTERVAL_MS = 60 * 1000;

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export interface SessionTimes {
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type SessionCheck = "valid" | "revoked" | "idle" | "expired";

export function checkSession(s: SessionTimes, now: Date = new Date()): SessionCheck {
  if (s.revokedAt) return "revoked";
  const t = now.getTime();
  if (t >= s.expiresAt.getTime() || t - s.createdAt.getTime() >= ADMIN_ABSOLUTE_TIMEOUT_MS)
    return "expired";
  if (t - s.lastSeenAt.getTime() >= ADMIN_IDLE_TIMEOUT_MS) return "idle";
  return "valid";
}

export function isLocked(lockedUntil: Date | null, now: Date = new Date()): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}

/** Hasil satu kegagalan login: hitungan baru & waktu kunci (bila mencapai batas). */
export function registerFailure(
  failedLoginCount: number,
  now: Date = new Date(),
): { failedLoginCount: number; lockedUntil: Date | null } {
  const next = failedLoginCount + 1;
  if (next >= LOGIN_MAX_ATTEMPTS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MS) };
  }
  return { failedLoginCount: next, lockedUntil: null };
}
