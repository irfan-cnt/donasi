import { describe, expect, it } from "vitest";
import {
  amountError,
  formatAmountDigits,
  normalizeIndonesianPhone,
  parseDonationInput,
  sanitizeAmountInput,
} from "@/lib/validation/donation";

const OPEN = { amountType: "open" as const, bounds: { min: 10_000n, max: 100_000_000n } };
const FIXED = { amountType: "fixed" as const, bounds: { min: 10_000n, max: 100_000_000n } };
const OPTION = "01936b1e-7c3a-7d4e-8f00-000000000001";

const base = { slug: "contoh", name: "Ahmad", email: "Ahmad@Example.com", website: "" };

describe("donation schema — nominal (AC-04.1, AC-04.2)", () => {
  it("menerima nominal dalam rentang sebagai bigint", () => {
    const r = parseDonationInput({ ...base, amount: "50000" }, OPEN);
    expect(r.ok && r.data.amount).toBe(50_000n);
    expect(r.ok && r.data.email).toBe("ahmad@example.com");
  });

  it("menolak nominal 13+ digit tanpa kehilangan presisi", () => {
    const r = parseDonationInput({ ...base, amount: "99999999999999" }, OPEN);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.fieldErrors.amount).toMatch(/13 digit/);
    // 13 digit valid secara format tetapi > max → ditolak oleh batas
    expect(amountError("9999999999999", OPEN.bounds)).toMatch(/Maksimal/);
  });

  it("menolak huruf", () => {
    const r = parseDonationInput({ ...base, amount: "10rb" }, OPEN);
    expect(!r.ok && r.fieldErrors.amount).toMatch(/angka/);
  });

  it("AC-04.2 (skenario 3): nominal negatif / desimal ditolak server, tidak dinormalisasi diam-diam", () => {
    for (const amount of ["-50000", "50000,5", "50000.5"]) {
      expect(parseDonationInput({ ...base, amount }, OPEN).ok, amount).toBe(false);
    }
  });

  it("menolak < min dan > max", () => {
    expect(amountError("9999", OPEN.bounds)).toMatch(/Minimal donasi Rp 10.000/);
    expect(amountError("100000001", OPEN.bounds)).toMatch(/Maksimal donasi Rp 100.000.000/);
    expect(amountError("10000", OPEN.bounds)).toBeNull();
    expect(amountError("100000000", OPEN.bounds)).toBeNull();
  });

  it("sanitasi input: hanya digit, tanpa nol depan, maks 13 digit", () => {
    expect(sanitizeAmountInput("9999999999999999")).toBe("9999999999999");
    expect(sanitizeAmountInput("Rp 0012.500abc")).toBe("12500");
    expect(formatAmountDigits("9999999999999")).toBe("9.999.999.999.999");
    expect(formatAmountDigits("9007199254740993")).toBe("9.007.199.254.740.993");
  });
});

describe("donation schema — fixed (AC-04.5)", () => {
  it("mengabaikan amount dari client dan mewajibkan optionId uuid", () => {
    const r = parseDonationInput({ ...base, amount: "1", optionId: OPTION }, FIXED);
    expect(r.ok && r.data.amount).toBeNull();
    expect(r.ok && r.data.optionId).toBe(OPTION);
    const bad = parseDonationInput({ ...base, optionId: "p3" }, FIXED);
    expect(!bad.ok && bad.fieldErrors.optionId).toBeTruthy();
  });
});

describe("donation schema — data donatur (AC-04.6)", () => {
  it("email wajib & valid; nama wajib kecuali anonim", () => {
    const noEmail = parseDonationInput({ ...base, email: "", amount: "50000" }, OPEN);
    expect(!noEmail.ok && noEmail.fieldErrors.email).toBeTruthy();
    const badEmail = parseDonationInput({ ...base, email: "x@", amount: "50000" }, OPEN);
    expect(!badEmail.ok && badEmail.fieldErrors.email).toBeTruthy();
    const noName = parseDonationInput({ ...base, name: "", amount: "50000" }, OPEN);
    expect(!noName.ok && noName.fieldErrors.name).toBeTruthy();
    const anon = parseDonationInput({ ...base, name: "", anonymous: "on", amount: "50000" }, OPEN);
    expect(anon.ok && anon.data.anonymous).toBe(true);
  });

  it("doa maksimal 280 karakter", () => {
    const r = parseDonationInput({ ...base, amount: "50000", prayer: "a".repeat(281) }, OPEN);
    expect(!r.ok && r.fieldErrors.prayer).toBeTruthy();
  });

  it("WA dinormalisasi ke E.164; consent hanya bila ada nomor", () => {
    expect(normalizeIndonesianPhone("0812 3456 7890")).toBe("+6281234567890");
    expect(normalizeIndonesianPhone("+62 812-3456-7890")).toBe("+6281234567890");
    expect(normalizeIndonesianPhone("12345")).toBeNull();
    const r = parseDonationInput({ ...base, amount: "50000", waConsent: "on" }, OPEN);
    expect(r.ok && r.data.waConsent).toBe(false);
    const r2 = parseDonationInput({ ...base, amount: "50000", phone: "081234567890", waConsent: "on" }, OPEN);
    expect(r2.ok && r2.data.phoneE164).toBe("+6281234567890");
    expect(r2.ok && r2.data.waConsent).toBe(true);
  });
});

describe("donation schema — honeypot", () => {
  it("menolak bila honeypot terisi", () => {
    const r = parseDonationInput({ ...base, amount: "50000", website: "http://spam" }, OPEN);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.honeypot).toBe(true);
  });
});
