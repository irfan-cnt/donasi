import { authenticator } from "otplib";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";
import { hasPermission, PERMISSION_CODES } from "@/lib/admin-auth/permissions";
import {
  ADMIN_ABSOLUTE_TIMEOUT_MS,
  ADMIN_IDLE_TIMEOUT_MS,
  checkSession,
  isLocked,
  LOCKOUT_MS,
  registerFailure,
} from "@/lib/admin-auth/session-policy";
import { buildAuditRow } from "@/lib/audit/audit-row";
import { diff } from "@/lib/audit/diff";
import { decryptWithKey, encryptWithKey, parseEncryptionKey, sha256 } from "@/lib/security/crypto";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { buildTotpUri, generateTotpSecret, verifyTotp } from "@/lib/security/totp";

const key = Buffer.alloc(32, 9);

describe("AES-256-GCM", () => {
  it("roundtrip & IV acak", () => {
    const a = encryptWithKey("JBSWY3DPEHPK3PXP", key);
    const b = encryptWithKey("JBSWY3DPEHPK3PXP", key);
    expect(a).not.toBe(b);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptWithKey(a, key)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("menolak ciphertext yang diubah atau kunci salah", () => {
    const enc = encryptWithKey("rahasia", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("xxxxxxx").toString("base64url");
    expect(() => decryptWithKey(parts.join("."), key)).toThrow();
    expect(() => decryptWithKey(enc, Buffer.alloc(32, 1))).toThrow();
  });

  it("validasi kunci 32 byte", () => {
    expect(parseEncryptionKey(key.toString("base64"))).toHaveLength(32);
    expect(() => parseEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 byte/);
    expect(() => parseEncryptionKey(undefined)).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it("sha256 token 32 byte", () => {
    expect(sha256("abc")).toHaveLength(32);
  });
});

describe("TOTP", () => {
  it("verifikasi kode saat ini, tolak kode salah/format salah", () => {
    const secret = generateTotpSecret();
    const code = authenticator.generate(secret);
    expect(verifyTotp(code, secret)).toBe(true);
    expect(verifyTotp(code === "000000" ? "111111" : "000000", secret)).toBe(false);
    expect(verifyTotp("12ab56", secret)).toBe(false);
    expect(verifyTotp("", secret)).toBe(false);
  });

  it("otpauth URL berisi issuer & email", () => {
    const uri = buildTotpUri("owner@example.test", "JBSWY3DPEHPK3PXP");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("issuer=Tebar%20Kebaikan%20Admin");
    expect(uri).toContain("owner%40example.test");
  });
});

describe("argon2id", () => {
  it("hash & verify", async () => {
    const h = await hashPassword("password-panjang-sekali");
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(h, "password-panjang-sekali")).toBe(true);
    expect(await verifyPassword(h, "salah")).toBe(false);
    expect(await verifyPassword("bukan-hash", "x")).toBe(false);
  });
});

describe("kebijakan sesi admin", () => {
  const t0 = new Date("2026-11-10T00:00:00Z");
  const base = {
    createdAt: t0,
    lastSeenAt: t0,
    expiresAt: new Date(t0.getTime() + ADMIN_ABSOLUTE_TIMEOUT_MS),
    revokedAt: null,
  };
  const at = (ms: number) => new Date(t0.getTime() + ms);

  it("valid sebelum idle 30 menit", () => {
    expect(checkSession(base, at(ADMIN_IDLE_TIMEOUT_MS - 1))).toBe("valid");
  });
  it("idle tepat 30 menit → ditolak", () => {
    expect(checkSession(base, at(ADMIN_IDLE_TIMEOUT_MS))).toBe("idle");
  });
  it("absolut 8 jam walau aktif terus", () => {
    const active = { ...base, lastSeenAt: at(ADMIN_ABSOLUTE_TIMEOUT_MS - 1000) };
    expect(checkSession(active, at(ADMIN_ABSOLUTE_TIMEOUT_MS - 1))).toBe("valid");
    expect(checkSession(active, at(ADMIN_ABSOLUTE_TIMEOUT_MS))).toBe("expired");
  });
  it("dicabut", () => {
    expect(checkSession({ ...base, revokedAt: t0 }, t0)).toBe("revoked");
  });
  it("lockout setelah 5 gagal, 15 menit (AC-22.1)", () => {
    let count = 0;
    let lockedUntil: Date | null = null;
    for (let i = 0; i < 5; i++)
      ({ failedLoginCount: count, lockedUntil } = registerFailure(count, t0));
    expect(lockedUntil?.getTime()).toBe(t0.getTime() + LOCKOUT_MS);
    expect(isLocked(lockedUntil, at(LOCKOUT_MS - 1))).toBe(true);
    expect(isLocked(lockedUntil, at(LOCKOUT_MS))).toBe(false);
    expect(registerFailure(3, t0)).toEqual({ failedLoginCount: 4, lockedUntil: null });
  });
});

describe("matriks permission BR-40", () => {
  const can = (role: keyof typeof ROLE_PERMISSIONS, p: (typeof PERMISSION_CODES)[number]) =>
    hasPermission(ROLE_PERMISSIONS[role], p);

  it("seed hanya memakai kode permission yang dikenal", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) expect(PERMISSION_CODES).toContain(p);
    }
  });
  it("owner punya semua permission", () => {
    for (const p of PERMISSION_CODES) expect(can("owner", p)).toBe(true);
  });
  it("editor tidak bisa akses transaksi/donatur/audit (AC-22.2)", () => {
    for (const p of ["transactions.read", "donors.read", "audit.read", "admins.manage"] as const) {
      expect(can("editor", p)).toBe(false);
    }
    expect(can("editor", "news.publish")).toBe(true);
  });
  it("finance read-only campaign, admin tanpa admins.manage/donors.export", () => {
    expect(can("finance", "campaigns.read")).toBe(true);
    expect(can("finance", "campaigns.write")).toBe(false);
    expect(can("admin", "admins.manage")).toBe(false);
    expect(can("admin", "donors.export")).toBe(false);
    expect(can("finance", "payment_methods.write")).toBe(true);
  });
});

describe("audit diff", () => {
  it("hanya field yang berubah", () => {
    expect(diff({ a: 1, b: "x", c: [1] }, { a: 1, b: "y", c: [1], d: true })).toEqual({
      before: { b: "x", d: undefined },
      after: { b: "y", d: true },
    });
  });
  it("create/delete menyimpan sisi yang ada; field sensitif di-redact", () => {
    expect(diff(null, { name: "A", passwordHash: "h" })).toEqual({
      before: null,
      after: { name: "A", passwordHash: "[redacted]" },
    });
  });
  it("buildAuditRow memetakan aktor", () => {
    const row = buildAuditRow({
      actor: { type: "admin", id: "11111111-1111-1111-1111-111111111111" },
      action: "admin.login",
      entityType: "admin_user",
      ip: "127.0.0.1",
      ua: "x".repeat(600),
    });
    expect(row.actorType).toBe("admin");
    expect(row.actorId).toBe("11111111-1111-1111-1111-111111111111");
    expect(row.userAgent).toHaveLength(512);
    expect(
      buildAuditRow({ actor: { type: "system" }, action: "a", entityType: "e" }).actorId,
    ).toBeNull();
  });
});
