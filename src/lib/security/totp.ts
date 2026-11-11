import "server-only";
import { authenticator } from "otplib";

// RFC 6238: SHA-1, 6 digit, periode 30 detik; toleransi ±1 langkah untuk selisih jam HP.
authenticator.options = { window: 1 };

export const TOTP_ISSUER = "Tebar Kebaikan Admin";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildTotpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, TOTP_ISSUER, secret);
}

const STEP_SECONDS = 30;

/**
 * P25 (M3): verifikasi + langkah waktu (time step, 30 s) yang cocok, untuk anti-replay.
 * null = kode salah. Pemanggil WAJIB mengklaim langkah ini secara atomik (claimTotpStep).
 */
export function verifyTotpStep(code: string, secret: string, nowMs: number = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  try {
    const delta = authenticator.clone({ ...authenticator.options, epoch: nowMs }).checkDelta(code, secret);
    return delta === null ? null : Math.floor(nowMs / 1000 / STEP_SECONDS) + delta;
  } catch {
    return null;
  }
}

export function verifyTotp(code: string, secret: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
