import "server-only";
import { isLocked, registerFailure, LOGIN_MAX_ATTEMPTS } from "@/lib/admin-auth/session-policy";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/redis";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/security/password";
import { generateTotpSecret, verifyTotp } from "@/lib/security/totp";
import { normalizeEmail } from "@/server/services/donor-account-service";
import {
  findAdminByEmail,
  findAdminById,
  updateAdmin,
} from "@/server/repositories/admin-repository";

export type LoginResult =
  { ok: true; adminId: string } | { ok: false; reason: "invalid" | "locked" | "rate_limited" };

interface Meta {
  ip: string | null;
  ua: string | null;
}

/**
 * Verifikasi login admin (F-22, AC-22.1). Tidak membuat sesi — pemanggil (action) yang
 * membuat sesi bila ok. Pesan ke pengguna dibuat generik (tanpa enumerasi email).
 */
export async function authenticateAdmin(
  input: { email: string; password: string; totp?: string },
  meta: Meta,
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const rl = await rateLimit(
    "admin-login",
    `${meta.ip ?? "unknown"}:${email}`,
    LOGIN_MAX_ATTEMPTS,
    "15 m",
  );
  if (!rl.success) return { ok: false, reason: "rate_limited" };

  const admin = await findAdminByEmail(email);
  if (!admin || admin.status === "disabled") {
    await verifyPassword(await getDummyHash(), input.password);
    await writeAudit({
      actor: { type: "system" },
      action: "admin.login_failed",
      entityType: "admin_user",
      metadata: { reason: "unknown_or_disabled" },
      ...meta,
    });
    return { ok: false, reason: "invalid" };
  }

  const audit = (action: string, metadata?: Record<string, unknown>) =>
    writeAudit({
      actor: { type: "admin", id: admin.id },
      action,
      entityType: "admin_user",
      entityId: admin.id,
      metadata,
      ...meta,
    });

  if (isLocked(admin.lockedUntil)) {
    await audit("admin.login_failed", { reason: "locked" });
    return { ok: false, reason: "locked" };
  }

  const fail = async (reason: string): Promise<LoginResult> => {
    const next = registerFailure(admin.failedLoginCount);
    await updateAdmin(admin.id, next);
    await audit("admin.login_failed", { reason });
    if (next.lockedUntil) {
      await audit("admin.lockout", { until: next.lockedUntil.toISOString() });
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid" };
  };

  if (!(await verifyPassword(admin.passwordHash, input.password))) return fail("password");

  if (admin.totpEnabled) {
    // Kode kosong/salah dihitung gagal & pesan tetap generik (tidak membocorkan password benar).
    if (
      !input.totp ||
      !admin.totpSecretEnc ||
      !verifyTotp(input.totp, decryptSecret(admin.totpSecretEnc))
    ) {
      return fail("totp");
    }
  }

  await updateAdmin(admin.id, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() });
  await audit("admin.login");
  return { ok: true, adminId: admin.id };
}

export async function changeAdminPassword(
  adminId: string,
  input: { currentPassword: string; newPassword: string },
  meta: Meta,
): Promise<{ ok: true } | { ok: false; reason: "invalid_current" | "same_as_old" }> {
  const admin = await findAdminById(adminId);
  if (!admin || !(await verifyPassword(admin.passwordHash, input.currentPassword))) {
    return { ok: false, reason: "invalid_current" };
  }
  if (await verifyPassword(admin.passwordHash, input.newPassword)) {
    return { ok: false, reason: "same_as_old" };
  }
  await updateAdmin(adminId, {
    passwordHash: await hashPassword(input.newPassword),
    mustChangePassword: false,
  });
  await writeAudit({
    actor: { type: "admin", id: adminId },
    action: "admin.password_change",
    entityType: "admin_user",
    entityId: adminId,
    before: { mustChangePassword: admin.mustChangePassword },
    after: { mustChangePassword: false },
    ...meta,
  });
  return { ok: true };
}

/** Secret TOTP yang belum aktif (disimpan terenkripsi). Dibuat bila belum ada. */
export async function getOrCreatePendingTotpSecret(adminId: string): Promise<string> {
  const admin = await findAdminById(adminId);
  if (!admin) throw new Error("Admin tidak ditemukan");
  if (admin.totpEnabled) throw new Error("TOTP sudah aktif");
  if (admin.totpSecretEnc) return decryptSecret(admin.totpSecretEnc);
  const secret = generateTotpSecret();
  await updateAdmin(adminId, { totpSecretEnc: encryptSecret(secret) });
  return secret;
}

export async function confirmTotpSetup(
  adminId: string,
  code: string,
  meta: Meta,
): Promise<{ ok: boolean }> {
  const admin = await findAdminById(adminId);
  if (!admin || admin.totpEnabled || !admin.totpSecretEnc) return { ok: false };
  if (!verifyTotp(code, decryptSecret(admin.totpSecretEnc))) return { ok: false };
  await updateAdmin(adminId, { totpEnabled: true });
  await writeAudit({
    actor: { type: "admin", id: adminId },
    action: "admin.totp_enable",
    entityType: "admin_user",
    entityId: adminId,
    before: { totpEnabled: false },
    after: { totpEnabled: true },
    ...meta,
  });
  return { ok: true };
}
