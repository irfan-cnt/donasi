/**
 * P25 (T-48): rate limit checkout & login admin menolak SEBELUM efek samping. Limiter Upstash
 * di-mock agar deterministik (limiter produksi tidak diubah; konfigurasinya diuji lewat argumen
 * yang dikirim). Checkout memakai DB Neon `dev` + sample seed; tidak ada baris yang tersisa.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const rl = vi.hoisted(() => ({
  rateLimit: vi.fn(async (...args: unknown[]) => (void args, { success: false, limit: 0, remaining: 0, reset: Date.now() + 60_000 })),
}));
vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<typeof import("@/lib/redis")>()), rateLimit: rl.rateLimit }));

const repo = vi.hoisted(() => ({ findAdminByEmail: vi.fn(), findAdminById: vi.fn(), updateAdmin: vi.fn() }));
vi.mock("@/server/repositories/admin-repository", () => repo);

const { createLogger } = await import("@/lib/logger");
const { createDonation } = await import("@/server/services/donation-service");
const { authenticateAdmin } = await import("@/server/services/admin-auth-service");

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const OPEN = "contoh-beasiswa-santri-penghafal-quran";

beforeEach(() => rl.rateLimit.mockClear());

describe("rate limit login admin", () => {
  it("limit terlampaui → rate_limited tanpa lookup admin / verifikasi password", async () => {
    const res = await authenticateAdmin({ email: " Admin@Contoh.TEST ", password: "salah" }, { ip: "203.0.113.9", ua: "vitest" });
    expect(res).toEqual({ ok: false, reason: "rate_limited" });
    expect(rl.rateLimit).toHaveBeenCalledWith("admin-login", "203.0.113.9:admin@contoh.test", 5, "15 m");
    expect(repo.findAdminByEmail).not.toHaveBeenCalled();
  });
});

describe.skipIf(!ENABLED)("rate limit checkout (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const email = `it+p25-rl-${randomUUID()}@example.test`;

  afterAll(async () => {
    await sql`delete from transactions where donor_email_snapshot = ${email}`;
    await sql`delete from donors where email = ${email} and user_id is null`;
  });

  it("limit IP terlampaui → 429 dan tidak ada transaksi dibuat", async () => {
    const res = await createDonation(
      { slug: OPEN, amount: "50000", name: "Uji RL", email, isAnonymous: "false" },
      { sessionDonor: null, ip: "203.0.113.77", userAgent: "vitest", log: createLogger({ test: "p25-rl" }) },
    );
    expect(res).toMatchObject({ ok: false, status: 429, reason: "rate_limited" });
    expect(rl.rateLimit.mock.calls[0]?.[0]).toBe("checkout-ip");
    const rows = await sql`select 1 from transactions where donor_email_snapshot = ${email}`;
    expect(rows).toHaveLength(0);
  });

  it("P25 OD-31: limit per nomor WA terlampaui → 429 tanpa transaksi", async () => {
    rl.rateLimit.mockImplementation(async (...args: unknown[]) => ({
      success: args[0] !== "checkout-phone", limit: 5, remaining: 0, reset: Date.now() + 60_000,
    }));
    const res = await createDonation(
      { slug: OPEN, amount: "50000", name: "Uji RL", email, phone: "0812-3456-7890", waConsent: "on" },
      { sessionDonor: null, ip: "203.0.113.78", userAgent: "vitest", log: createLogger({ test: "p25-rl" }) },
    );
    expect(res).toMatchObject({ ok: false, status: 429, reason: "rate_limited" });
    expect(rl.rateLimit.mock.calls.map((c) => c[0])).toEqual(["checkout-ip", "checkout-email", "checkout-phone"]);
    expect(rl.rateLimit.mock.calls[2]?.[1]).toBe("+6281234567890");
    const rows = await sql`select 1 from transactions where donor_email_snapshot = ${email}`;
    expect(rows).toHaveLength(0);
  });
});
