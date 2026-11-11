import { describe, expect, it } from "vitest";
import { isTransactionCode } from "@/lib/transaction-code";
import {
  assertSampleAllowed,
  generatePassword,
  parseAdminArgs,
  parseSeedMode,
} from "../../scripts/seed/cli";
import {
  NOTIFICATION_TEMPLATES,
  PAYMENT_METHODS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../../scripts/seed/reference-data";
import {
  SAMPLE_CAMPAIGNS,
  TX_STATUS_COUNTS,
  assignReceiptNumbers,
  buildSampleDonors,
  buildSampleNews,
  SAMPLE_ANCHOR,
  buildSampleTransactions,
  hasSamplePayment,
  paidTotalsByCampaign,
} from "../../scripts/seed/sample-data";
import { RECONCILE_WINDOW_HOURS } from "@/server/services/jobs/reconcile";

describe("parseSeedMode", () => {
  it("default reference", () => expect(parseSeedMode([])).toBe("reference"));
  it("--sample", () => expect(parseSeedMode(["--sample"])).toBe("sample"));
  it("menolak flag tak dikenal & kombinasi", () => {
    expect(() => parseSeedMode(["--prod"])).toThrow();
    expect(() => parseSeedMode(["--reference", "--sample"])).toThrow();
  });
  it("sample ditolak di production", () => {
    expect(() => assertSampleAllowed("production")).toThrow(/production/);
    expect(() => assertSampleAllowed("development")).not.toThrow();
    expect(() => assertSampleAllowed(undefined)).not.toThrow();
  });
});

describe("parseAdminArgs", () => {
  it("parse & normalisasi email", () => {
    expect(
      parseAdminArgs(["--email", "Owner@Example.com", "--name", "Pemilik", "--role=owner"]),
    ).toEqual({ email: "owner@example.com", name: "Pemilik", role: "owner" });
  });
  it("menolak input tidak valid", () => {
    expect(() =>
      parseAdminArgs(["--email", "bukan-email", "--name", "Ab", "--role", "owner"]),
    ).toThrow();
    expect(() =>
      parseAdminArgs(["--email", "a@example.com", "--name", "Ab", "--role", "root"]),
    ).toThrow();
    expect(() => parseAdminArgs(["--email"])).toThrow(/kosong/);
    expect(() => parseAdminArgs(["--x", "1"])).toThrow(/tidak dikenal/);
  });
});

describe("generatePassword", () => {
  it("20 karakter, memuat semua kelas, unik", () => {
    const a = generatePassword(20);
    expect(a).toHaveLength(20);
    expect(a).toMatch(/[a-z]/);
    expect(a).toMatch(/[A-Z]/);
    expect(a).toMatch(/[0-9]/);
    expect(a).toMatch(/[^a-zA-Z0-9]/);
    expect(generatePassword(20)).not.toBe(a);
  });
});

describe("reference data", () => {
  it("BR-40: owner semua permission; settings/admins hanya owner", () => {
    expect(ROLE_PERMISSIONS.owner).toHaveLength(PERMISSIONS.length);
    for (const role of ["admin", "finance", "editor"] as const) {
      expect(ROLE_PERMISSIONS[role]).not.toContain("settings.write");
      expect(ROLE_PERMISSIONS[role]).not.toContain("admins.manage");
    }
    expect(ROLE_PERMISSIONS.admin).not.toContain("donors.export");
    expect(ROLE_PERMISSIONS.finance).toContain("payment_methods.write");
    expect(ROLE_PERMISSIONS.editor).not.toContain("campaigns.publish");
  });
  it("9 metode Midtrans & 7 email + 4 WA; donation.created nonaktif", () => {
    expect(PAYMENT_METHODS.map((m) => m.code)).toHaveLength(9);
    expect(NOTIFICATION_TEMPLATES.filter((t) => t.channel === "email")).toHaveLength(7);
    expect(NOTIFICATION_TEMPLATES.filter((t) => t.channel === "whatsapp")).toHaveLength(4);
    expect(
      NOTIFICATION_TEMPLATES.filter((t) => t.event === "donation.created").every(
        (t) => !t.isActive,
      ),
    ).toBe(true);
    for (const t of NOTIFICATION_TEMPLATES)
      if (t.channel === "email") expect(t.subject).toBeTruthy();
  });
});

describe("sample data", () => {
  it("8 campaign: 5 open (2 tanpa target), 3 fixed; judul 10–120", () => {
    expect(SAMPLE_CAMPAIGNS).toHaveLength(8);
    const open = SAMPLE_CAMPAIGNS.filter((c) => c.amountType === "open");
    expect(open).toHaveLength(5);
    expect(open.filter((c) => c.targetAmount === null)).toHaveLength(2);
    for (const c of SAMPLE_CAMPAIGNS) {
      expect(c.title.length).toBeGreaterThanOrEqual(10);
      expect(c.title.length).toBeLessThanOrEqual(120);
      expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
  it("12 berita & 40 donor example.com dengan 10 akun, nomor valid", () => {
    expect(buildSampleNews()).toHaveLength(12);
    const donors = buildSampleDonors();
    expect(donors).toHaveLength(40);
    expect(donors.filter((d) => d.hasAccount)).toHaveLength(10);
    for (const d of donors) {
      expect(d.email).toMatch(/@example\.com$/);
      if (d.phoneE164) expect(d.phoneE164).toMatch(/^\+628000000\d{4}$/);
    }
  });
  it("300 transaksi deterministik, kode unik & valid, invariant paid_at", () => {
    const a = buildSampleTransactions();
    expect(a).toHaveLength(300);
    expect(buildSampleTransactions().map((t) => t.code)).toEqual(a.map((t) => t.code));
    expect(new Set(a.map((t) => t.code)).size).toBe(300);
    for (const t of a) {
      expect(isTransactionCode(t.code)).toBe(true);
      expect(t.amount).toBeGreaterThanOrEqual(1000n);
      expect(t.paidAt !== null).toBe(t.status === "paid" || t.status === "refunded");
      expect(t.methodCode === null).toBe(t.status === "created" || t.status === "pending");
      expect(SAMPLE_CAMPAIGNS.find((c) => c.slug === t.campaignSlug)!.status).not.toBe("draft");
    }
    for (const [status, n] of Object.entries(TX_STATUS_COUNTS)) {
      expect(a.filter((t) => t.status === status)).toHaveLength(n);
    }
  });
  it("tidak ada payment contoh yang bisa dipilih job expire-payments/reconcile (404 storm)", () => {
    const txs = buildSampleTransactions();
    // Transaksi pending tetap ada untuk tampilan admin/dashboard, tetapi tanpa payment.
    expect(txs.filter((t) => t.status === "pending")).toHaveLength(TX_STATUS_COUNTS.pending);
    const withPayment = txs.filter((t) => t.methodCode !== null);
    expect(withPayment.length).toBeGreaterThan(0);
    const maxExpiryMs = Math.max(...PAYMENT_METHODS.map((m) => m.expiryMinutes)) * 60_000;
    // Jendela kandidat reconcile (created/updated 48 jam) dihitung dari waktu nyata; data contoh
    // berlabuh pada SAMPLE_ANCHOR yang tetap, jadi cukup dipastikan semuanya ≤ anchor + jitter.
    const latestAllowed = SAMPLE_ANCHOR.getTime() + maxExpiryMs + 4 * 3_600_000;
    expect(latestAllowed + RECONCILE_WINDOW_HOURS * 3_600_000).toBeLessThan(Date.now());
    for (const t of withPayment) {
      expect(hasSamplePayment(t.status)).toBe(true);
      // expire-payments hanya memilih payments.status = 'pending'; reconcile melewati `created`
      // baru — keduanya tidak pernah ada di data contoh.
      expect(["pending", "created"]).not.toContain(t.status);
      expect(t.createdAt.getTime() + maxExpiryMs).toBeLessThanOrEqual(latestAllowed);
      expect((t.paidAt ?? t.createdAt).getTime()).toBeLessThanOrEqual(latestAllowed);
    }
  });
  it("kuitansi berurutan untuk paid; total paid per campaign", () => {
    const txs = buildSampleTransactions();
    const { receipts, lastSeqByYear } = assignReceiptNumbers(txs);
    expect(receipts.size).toBe(TX_STATUS_COUNTS.paid);
    expect([...lastSeqByYear.values()].reduce((x, y) => x + y, 0)).toBe(TX_STATUS_COUNTS.paid);
    const totals = paidTotalsByCampaign([
      { campaignSlug: "a", status: "paid", amount: 10_000n },
      { campaignSlug: "a", status: "pending", amount: 50_000n },
      { campaignSlug: "a", status: "paid", amount: 25_000n },
    ]);
    expect(totals.get("a")).toEqual({ collected: 35_000n, count: 2 });
  });
});
