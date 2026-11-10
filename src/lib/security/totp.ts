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

export function verifyTotp(code: string, secret: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
