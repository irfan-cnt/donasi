import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, redact, redactUrlTokens } from "@/lib/logger";
import { remainingUntil, POLL_INTERVAL_MS, POLL_MAX_MS } from "@/lib/payments/countdown";
import { fillPlaceholders, renderInstructionSections } from "@/lib/payments/instruction-template";
import { transactionStatusQuery, transactionStatusResponse } from "@/lib/validation/transaction-status";
import { transactionPageInput } from "@/lib/validation/transaction-page";

const TOKEN = "abcDEF0123456789_-abcDEF0123456789_-abcDEF0"; // 43
const CODE = "TK-261110-7QF3KD";

describe("instruction template (P12)", () => {
  const vars = { va_number: "8808123456789", amount: "Rp 50.000", bank_name: "BNI" };

  it("mengisi {{va_number}}, {{amount}}, {{bank_name}} (spasi di dalam kurung diterima)", () => {
    expect(fillPlaceholders("Transfer {{amount}} ke VA {{ va_number }} di {{bank_name}}.", vars)).toBe(
      "Transfer Rp 50.000 ke VA 8808123456789 di BNI.",
    );
  });

  it("placeholder tak dikenal / kosong → '-'", () => {
    expect(fillPlaceholders("{{secret}} {{va_number}}", { amount: "x" })).toBe("- -");
  });

  it("HTML tetap teks literal (tidak pernah dirender sebagai HTML) & nilai tidak dievaluasi ulang", () => {
    const out = fillPlaceholders("<img src=x onerror=alert(1)> {{bank_name}}", { bank_name: "{{va_number}}<b>" });
    expect(out).toBe("<img src=x onerror=alert(1)> {{va_number}}<b>");
  });

  it("membuang karakter kontrol & bidi override", () => {
    expect(fillPlaceholders("a‮b\u0007c", {})).toBe("abc");
  });

  it("JSONB tidak valid → [] ; valid → judul & langkah terisi", () => {
    expect(renderInstructionSections("bukan array", vars)).toEqual([]);
    expect(renderInstructionSections([{ title: 1, steps: [] }], vars)).toEqual([]);
    expect(
      renderInstructionSections([{ title: "ATM {{bank_name}}", steps: ["Masukkan {{va_number}}"] }], vars),
    ).toEqual([{ title: "ATM BNI", steps: ["Masukkan 8808123456789"] }]);
  });
});

describe("countdown helper", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  it("format HH:MM:SS, jam bisa > 24", () => {
    expect(remainingUntil(new Date(now.getTime() + 3_725_000), now)).toEqual({
      expired: false,
      totalSeconds: 3725,
      label: "01:02:05",
    });
    expect(remainingUntil(new Date(now.getTime() + 25 * 3600_000), now).label).toBe("25:00:00");
  });
  it("lewat / tepat / tanggal tak valid → expired 00:00:00", () => {
    expect(remainingUntil(new Date(now.getTime() - 1000), now)).toMatchObject({ expired: true, label: "00:00:00" });
    expect(remainingUntil(now, now).expired).toBe(true);
    expect(remainingUntil("bukan-tanggal", now).expired).toBe(true);
    expect(remainingUntil(now.toISOString(), now.getTime() - 999).expired).toBe(true);
  });
  it("polling 5 s maks 10 menit (AC-08.1)", () => {
    expect(POLL_INTERVAL_MS).toBe(5000);
    expect(POLL_MAX_MS).toBe(600_000);
  });
});

describe("status endpoint schema", () => {
  it("query: kode TK + token 43 karakter", () => {
    expect(transactionStatusQuery.safeParse({ code: CODE, t: TOKEN }).success).toBe(true);
    expect(transactionStatusQuery.safeParse({ code: "TK-1", t: TOKEN }).success).toBe(false);
    expect(transactionStatusQuery.safeParse({ code: CODE, t: "pendek" }).success).toBe(false);
    expect(transactionStatusQuery.safeParse({ code: CODE, t: `${TOKEN.slice(0, 42)}!` }).success).toBe(false);
  });
  it("respons hanya {status, paidAt} — field lain ditolak", () => {
    expect(transactionStatusResponse.parse({ status: "pending", paidAt: null })).toEqual({ status: "pending", paidAt: null });
    expect(transactionStatusResponse.safeParse({ status: "paid", paidAt: "2026-11-10T01:02:03.000Z" }).success).toBe(true);
    expect(transactionStatusResponse.safeParse({ status: "paid", paidAt: null, amount: "1" }).success).toBe(false);
    expect(transactionStatusResponse.safeParse({ status: "lunas", paidAt: null }).success).toBe(false);
  });
  it("halaman: query lain (status=paid) tidak memengaruhi; token array ditolak", () => {
    expect(transactionPageInput.safeParse({ code: CODE, t: TOKEN }).success).toBe(true);
    expect(transactionPageInput.safeParse({ code: CODE, t: [TOKEN, TOKEN] }).success).toBe(false);
  });
});

describe("logger: redaksi access token di URL", () => {
  afterEach(() => vi.restoreAllMocks());

  it("meredaksi ?t=, &t=, ?token= dan bentuk ter-encode", () => {
    expect(redactUrlTokens(`/transaksi/${CODE}/instruksi?t=${TOKEN}`)).toBe(`/transaksi/${CODE}/instruksi?t=[REDACTED]`);
    expect(redactUrlTokens(`/donasi/x/pembayaran?trx=${CODE}&t=${TOKEN}&a=1`)).toBe(
      `/donasi/x/pembayaran?trx=${CODE}&t=[REDACTED]&a=1`,
    );
    expect(redactUrlTokens(`/campaign/x/pratinjau?token=abc.def`)).toBe("/campaign/x/pratinjau?token=[REDACTED]");
    expect(redactUrlTokens(`/masuk?callbackUrl=%2Ftransaksi%2FX%3Ft%3D${TOKEN}`)).toBe(
      "/masuk?callbackUrl=%2Ftransaksi%2FX%3Ft%3D[REDACTED]",
    );
    // Parameter lain yang kebetulan berakhiran t tidak tersentuh.
    expect(redactUrlTokens("/x?trx=TK&at=1&limit=5")).toBe("/x?trx=TK&at=1&limit=5");
  });

  it("redact() menyentuh string bertingkat, URL, dan kunci sensitif", () => {
    const out = redact({
      url: new URL(`https://e.test/a?t=${TOKEN}`),
      nested: { href: `/x?t=${TOKEN}`, list: [`?t=${TOKEN}`] },
      accessToken: "rahasia",
      amount: 5n,
    });
    expect(JSON.stringify(out)).not.toContain(TOKEN);
    expect(out.accessToken).toBe("[REDACTED]");
    expect(out.amount).toBe("5");
  });

  it("baris log (msg & field) tidak memuat token", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l: string) => void lines.push(l));
    createLogger({ path: `/transaksi/${CODE}/menunggu?t=${TOKEN}` }).info(`GET /api/transactions/${CODE}/status?t=${TOKEN}`);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(TOKEN);
    expect(lines[0]).toContain("[REDACTED]");
  });
});
