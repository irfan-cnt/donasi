/**
 * P25 (M3, L9): anti-replay TOTP & increment gagal login atomik, terhadap DB Neon `dev`.
 * Admin uji ber-email `it+…@example.test` dibuat & dihapus sendiri; rate limit Upstash di-mock
 * (selalu lolos) agar uji tidak memakai kuota nyata.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { authenticator } from "otplib";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async (orig) => ({
  ...(await orig<typeof import("@/lib/redis")>()),
  rateLimit: vi.fn(async () => ({ success: true, limit: 5, remaining: 4, reset: Date.now() + 60_000 })),
}));

const { encryptSecret } = await import("@/lib/security/crypto");
const { hashPassword } = await import("@/lib/security/password");
const { verifyTotpStep } = await import("@/lib/security/totp");
const { authenticateAdmin, confirmTotpSetup } = await import("@/server/services/admin-auth-service");

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const PASSWORD = "Password-Uji-P25-123";

describe("verifyTotpStep (unit)", () => {
  it("mengembalikan langkah waktu; kode salah → null", () => {
    const secret = authenticator.generateSecret();
    const now = 1_800_000_000_000;
    const code = authenticator.clone({ ...authenticator.options, epoch: now }).generate(secret);
    expect(verifyTotpStep(code, secret, now)).toBe(Math.floor(now / 30_000));
    expect(verifyTotpStep(code, secret, now + 30_000)).toBe(Math.floor(now / 30_000)); // toleransi -1
    expect(verifyTotpStep("000000", secret, now + 10 * 60_000)).toBeNull();
    expect(verifyTotpStep("abc", secret, now)).toBeNull();
  });
});

describe.skipIf(!ENABLED)("auth admin P25 (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const ids: string[] = [];
  const meta = { ip: "203.0.113.50", ua: "vitest" };
  const secret = authenticator.generateSecret();

  async function newAdmin(totpEnabled: boolean) {
    const id = randomUUID();
    ids.push(id);
    const email = `it+p25-admin-${id}@example.test`;
    await sql`insert into admin_users (id, email, name, password_hash, must_change_password, totp_enabled, totp_secret_enc)
      values (${id}, ${email}, 'Uji P25', ${await hashPassword(PASSWORD)}, false, ${totpEnabled}, ${encryptSecret(secret)})`;
    return { id, email };
  }

  afterAll(async () => {
    if (!ids.length) return;
    await sql`delete from audit_logs where entity_id = any(${ids}::text[])`;
    await sql`delete from admin_users where id = any(${ids}::uuid[])`;
  });

  it("M3: kode TOTP yang sama tidak bisa dipakai dua kali untuk login", async () => {
    const a = await newAdmin(true);
    const code = authenticator.generate(secret);
    expect(await authenticateAdmin({ email: a.email, password: PASSWORD, totp: code }, meta)).toMatchObject({ ok: true });
    expect(await authenticateAdmin({ email: a.email, password: PASSWORD, totp: code }, meta)).toEqual({ ok: false, reason: "invalid" });
    const audits = await sql`select metadata->>'reason' as r from audit_logs where entity_id = ${a.id} and action = 'admin.login_failed'`;
    expect(audits.map((x) => x.r)).toContain("totp_replay");
  });

  it("M3: login paralel dengan kode sama → hanya satu yang berhasil", async () => {
    const a = await newAdmin(true);
    const code = authenticator.generate(secret);
    const results = await Promise.all([1, 2, 3].map(() => authenticateAdmin({ email: a.email, password: PASSWORD, totp: code }, meta)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("M3: kode setup TOTP tidak bisa dipakai ulang untuk login", async () => {
    const a = await newAdmin(false);
    const code = authenticator.generate(secret);
    expect(await confirmTotpSetup(a.id, code, meta)).toEqual({ ok: true });
    expect(await authenticateAdmin({ email: a.email, password: PASSWORD, totp: code }, meta)).toMatchObject({ ok: false });
  });

  it("L9: password salah paralel dihitung atomik → terkunci setelah 5", async () => {
    const a = await newAdmin(true);
    await Promise.all([1, 2, 3, 4].map((i) => authenticateAdmin({ email: a.email, password: `salah-${i}` }, meta)));
    const [row] = await sql`select failed_login_count, locked_until from admin_users where id = ${a.id}`;
    expect(row).toMatchObject({ failed_login_count: 4, locked_until: null });
    expect(await authenticateAdmin({ email: a.email, password: "salah-5" }, meta)).toEqual({ ok: false, reason: "locked" });
    const [locked] = await sql`select failed_login_count, locked_until from admin_users where id = ${a.id}`;
    expect(locked!.locked_until).not.toBeNull();
    expect(locked!.failed_login_count).toBe(0);
  });
});
