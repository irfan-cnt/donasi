import { describe, expect, it } from "vitest";
import {
  expiryLabel,
  groupMethods,
  supportsAmount,
  type AvailableMethod,
} from "@/lib/payments/method-groups";
import { createPaymentInput } from "@/lib/validation/payment";

const m = (code: string, type: AvailableMethod["type"], order: number, min = 1000n, max: bigint | null = null): AvailableMethod => ({
  id: code,
  code,
  type,
  displayName: code,
  logoUrl: null,
  minAmount: min,
  maxAmount: max,
  expiryMinutes: 1440,
  displayOrder: order,
});

describe("groupMethods", () => {
  const methods = [
    m("bni_va", "virtual_account", 50),
    m("qris", "qris", 10, 1000n, 10_000_000n),
    m("gopay", "ewallet", 20, 1000n, 2_000_000n),
    m("bca_va", "virtual_account", 40, 10_000n),
    m("alfamart", "retail", 5),
  ];

  it("mengelompokkan QRIS → E-Wallet → Virtual Account, urut display_order, tanpa retail/card", () => {
    const g = groupMethods(methods, 50_000n);
    expect(g.map((x) => x.title)).toEqual(["QRIS", "E-Wallet", "Virtual Account"]);
    expect(g[2]!.methods.map((x) => x.code)).toEqual(["bca_va", "bni_va"]);
  });

  it("menyembunyikan metode yang tidak mendukung nominal & grup kosong", () => {
    expect(groupMethods(methods, 5_000n).flatMap((g) => g.methods.map((x) => x.code))).toEqual([
      "qris",
      "gopay",
      "bni_va",
    ]);
    const big = groupMethods(methods, 5_000_000n);
    expect(big.map((g) => g.key)).toEqual(["qris", "virtual_account"]);
  });

  it("batas inklusif & max null = tanpa batas", () => {
    expect(supportsAmount({ minAmount: 1000n, maxAmount: 2000n }, 1000n)).toBe(true);
    expect(supportsAmount({ minAmount: 1000n, maxAmount: 2000n }, 2000n)).toBe(true);
    expect(supportsAmount({ minAmount: 1000n, maxAmount: 2000n }, 2001n)).toBe(false);
    expect(supportsAmount({ minAmount: 1000n, maxAmount: null }, 999n)).toBe(false);
    expect(supportsAmount({ minAmount: 1000n, maxAmount: null }, 10n ** 12n)).toBe(true);
  });

  it("kosong bila tidak ada metode", () => {
    expect(groupMethods([], 10_000n)).toEqual([]);
  });

  it("label masa berlaku", () => {
    expect(expiryLabel(15)).toBe("15 menit");
    expect(expiryLabel(1440)).toBe("24 jam");
    expect(expiryLabel(4320)).toBe("3 hari");
  });
});

describe("createPaymentInput", () => {
  const ok = { slug: "beasiswa-santri", trx: "TK-261110-7QF3KD", t: "A".repeat(43), method: "bca_va" };

  it("menerima input sah", () => {
    expect(createPaymentInput.safeParse(ok).success).toBe(true);
  });

  it.each([
    ["slug huruf besar", { ...ok, slug: "Beasiswa" }],
    ["kode transaksi salah", { ...ok, trx: "TK-1-ABC" }],
    ["token pendek", { ...ok, t: "abc" }],
    ["token karakter ilegal", { ...ok, t: "!".repeat(43) }],
    ["metode kosong", { ...ok, method: "" }],
    ["metode karakter ilegal", { ...ok, method: "bca va'" }],
    ["metode hilang", { slug: ok.slug, trx: ok.trx, t: ok.t }],
  ])("menolak %s", (_n, v) => {
    expect(createPaymentInput.safeParse(v).success).toBe(false);
  });
});
