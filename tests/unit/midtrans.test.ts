import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/lib/env";
import type { MidtransEventRecord } from "@/lib/payments/midtrans/event-log";
import { MidtransError } from "@/lib/payments/midtrans/errors";
import {
  buildChargeBody,
  chargeKindForChannel,
  computeSignature,
  formatOrderTime,
  mapTransactionStatus,
  normalizeInstruction,
  parseGrossAmount,
  signatureMatches,
} from "@/lib/payments/midtrans/mapping";
import { createMidtransProvider } from "@/lib/payments/midtrans/provider";
import { redactPayload } from "@/lib/payments/midtrans/redact";
import type { CreatePaymentInput } from "@/lib/payments/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- akses body JSON di test
type AnyBody = Record<string, any>;

const SERVER_KEY = "SB-Mid-server-UNITTESTKEY123";
const ORDER = "0194f0a0-0000-7000-8000-000000000001";
const NOW = new Date("2026-11-10T03:00:00Z"); // 10:00 WIB
const fixture = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/midtrans/${name}.json`, "utf8")) as Record<
    string,
    unknown
  >;

const input = (channel: string, over: Partial<CreatePaymentInput> = {}): CreatePaymentInput => ({
  paymentId: ORDER,
  transactionCode: "TK-261110-ABC123",
  amount: 50_000n,
  method: { code: channel, type: "virtual_account", providerChannel: channel },
  customer: { name: "Fulan", email: "fulan@example.com", phone: "081234567890" },
  description: "Sedekah Air Bersih untuk Pelosok Negeri yang Sangat Membutuhkan Bantuan",
  campaignId: "0194f0a0-0000-7000-8000-0000000000aa",
  expiresInMinutes: 1440,
  successRedirectUrl: "https://example.org/transaksi/TK/instruksi",
  ...over,
});

function setup(responses: Array<Record<string, unknown> | Error>) {
  const events: MidtransEventRecord[] = [];
  const calls: { url: string; init: RequestInit }[] = [];
  const queue = [...responses];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    const next = queue.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next), { status: 200 });
  });
  const provider = createMidtransProvider({
    serverKey: SERVER_KEY,
    isProduction: false,
    recordEvent: async (e) => {
      events.push(e);
    },
    fetch: fetchMock as unknown as typeof fetch,
    now: () => NOW,
  });
  return { provider, events, calls, fetchMock };
}

describe("pemetaan status Midtrans", () => {
  it.each([
    ["settlement", undefined, "paid", false],
    ["capture", "accept", "paid", false],
    ["capture", "challenge", "pending", true],
    ["capture", "deny", "failed", false],
    ["pending", undefined, "pending", false],
    ["PENDING", undefined, "pending", false],
    ["expire", undefined, "expired", false],
    ["deny", undefined, "failed", false],
    ["failure", undefined, "failed", false],
    ["cancel", undefined, "cancelled", false],
    ["refund", undefined, "refunded", true],
  ])("%s/%s → %s", (ts, fs, status, review) => {
    expect(mapTransactionStatus(ts, fs)).toEqual({ status, needsReview: review });
  });

  it("partial_refund → refunded + partialRefund (P25: tidak diterapkan otomatis)", () => {
    expect(mapTransactionStatus("partial_refund")).toEqual({ status: "refunded", needsReview: true, partialRefund: true });
  });

  it.each(["authorize", "chargeback", "", undefined])("status tak dikenal %s → error", (ts) => {
    expect(() => mapTransactionStatus(ts)).toThrow(MidtransError);
  });
});

describe("pemetaan payment_type", () => {
  it.each([
    ["qris", { paymentType: "qris" }],
    ["gopay", { paymentType: "gopay" }],
    ["shopeepay", { paymentType: "shopeepay" }],
    ["bca", { paymentType: "bank_transfer", bank: "bca" }],
    ["bni", { paymentType: "bank_transfer", bank: "bni" }],
    ["bri", { paymentType: "bank_transfer", bank: "bri" }],
    ["cimb", { paymentType: "bank_transfer", bank: "cimb" }],
    ["permata", { paymentType: "permata" }],
    ["echannel", { paymentType: "echannel" }],
  ])("%s", (channel, expected) => {
    expect(chargeKindForChannel(channel)).toEqual(expected);
  });

  it("kanal tak dikenal ditolak", () => {
    expect(() => chargeKindForChannel("ovo")).toThrow(MidtransError);
  });

  it("body charge: order_id, gross_amount, item tunggal ≤50, custom_expiry WIB", () => {
    const body = buildChargeBody(input("bca"), NOW) as AnyBody;
    expect(body.payment_type).toBe("bank_transfer");
    expect(body.bank_transfer).toEqual({ bank: "bca" });
    expect(body.transaction_details).toEqual({ order_id: ORDER, gross_amount: 50000 });
    expect(body.item_details).toHaveLength(1);
    expect(body.item_details[0].name.length).toBeLessThanOrEqual(50);
    expect(body.item_details[0].price * body.item_details[0].quantity).toBe(50000);
    expect(body.custom_expiry).toEqual({
      order_time: "2026-11-10 10:00:00 +0700",
      expiry_duration: 1440,
      unit: "minute",
    });
    expect(body.customer_details).toEqual({
      first_name: "Fulan",
      email: "fulan@example.com",
      phone: "081234567890",
    });
  });

  it("body per kanal khusus", () => {
    const e = buildChargeBody(input("echannel"), NOW) as AnyBody;
    expect(e.echannel.bill_info1.length).toBeLessThanOrEqual(10);
    expect(e.echannel.bill_info2.length).toBeLessThanOrEqual(30);
    expect((buildChargeBody(input("permata"), NOW) as AnyBody).bank_transfer).toBeUndefined();
    expect((buildChargeBody(input("qris"), NOW) as AnyBody).qris).toEqual({ acquirer: "gopay" });
    expect((buildChargeBody(input("gopay"), NOW) as AnyBody).gopay.callback_url).toContain(
      "https://",
    );
    expect(
      (buildChargeBody(input("shopeepay"), NOW) as AnyBody).shopeepay.callback_url,
    ).toBeTruthy();
  });

  it("nominal di luar batas ditolak", () => {
    expect(() => buildChargeBody(input("bca", { amount: 0n }), NOW)).toThrow(MidtransError);
  });

  it("order_time selalu +0700", () => {
    expect(formatOrderTime(new Date("2026-12-31T20:30:05Z"))).toBe("2027-01-01 03:30:05 +0700");
  });
});

describe("gross_amount", () => {
  it.each([
    ["100000.00", 100000n],
    ["100000", 100000n],
    [100000, 100000n],
    ["999999999999.00", 999999999999n],
  ])("%s", (v, out) => expect(parseGrossAmount(v)).toBe(out));
  it.each(["100.50", "-1", "1e5", "", null])("%s ditolak", (v) => {
    expect(() => parseGrossAmount(v)).toThrow(MidtransError);
  });
});

describe("normalisasi instruksi (fixture sandbox)", () => {
  const fb = new Date(0);
  const expiry = new Date("2026-11-11T03:00:00Z");
  it.each([
    ["bca", "BCA", "812785002530231"],
    ["bni", "BNI", "9888500212345678"],
    ["bri", "BRI", "8578000000111111"],
    ["cimb", "CIMB Niaga", "2810490150230740"],
    ["permata", "Permata", "850003072869607"],
  ])("VA %s", (channel, bankName, vaNumber) => {
    expect(normalizeInstruction(channel, fixture(`charge-${channel}`), fb)).toEqual({
      kind: "virtual_account",
      bankName,
      vaNumber,
      expiresAt: expiry,
    });
  });

  it("Mandiri bill", () => {
    expect(normalizeInstruction("echannel", fixture("charge-echannel"), fb)).toEqual({
      kind: "payment_code",
      bankName: "Mandiri",
      billerCode: "70012",
      billKey: "778347787706",
      paymentCode: "778347787706",
      expiresAt: expiry,
    });
  });

  it("QRIS memakai qr_string, bukan URL gambar Midtrans", () => {
    const i = normalizeInstruction("qris", fixture("charge-qris"), fb);
    expect(i.kind).toBe("qr");
    expect(i.qrString).toMatch(/^000201/);
    expect(i.qrImageUrl).toBeUndefined();
    expect(JSON.stringify(i)).not.toContain("qr-code");
  });

  it("GoPay → deeplink, tanpa URL QR", () => {
    const i = normalizeInstruction("gopay", fixture("charge-gopay"), fb);
    expect(i).toMatchObject({ kind: "redirect", paymentUrl: expect.stringContaining("gopay") });
    expect(JSON.stringify(i)).not.toContain("qr-code");
  });

  it("ShopeePay → deeplink", () => {
    expect(normalizeInstruction("shopeepay", fixture("charge-shopeepay"), fb)).toMatchObject({
      kind: "redirect",
      paymentUrl: expect.stringContaining("shopeepay"),
    });
  });

  it("tanpa expiry_time → fallback", () => {
    const res = { ...fixture("charge-bca"), expiry_time: undefined };
    expect(normalizeInstruction("bca", res, fb).expiresAt).toEqual(fb);
  });

  it("field wajib hilang → invalid_response", () => {
    expect(() => normalizeInstruction("bca", { va_numbers: [] }, fb)).toThrow(MidtransError);
  });
});

describe("signature", () => {
  // Vektor buatan sendiri: dihitung independen dengan createHash di test ini.
  const vector = {
    order_id: "order-101",
    status_code: "200",
    gross_amount: "100000.00",
    key: "SB-Mid-server-VECTORKEY",
  };
  const expected = createHash("sha512")
    .update("order-101200100000.00SB-Mid-server-VECTORKEY")
    .digest("hex");

  it("SHA512(order_id+status_code+gross_amount+server_key)", () => {
    expect(
      computeSignature(vector.order_id, vector.status_code, vector.gross_amount, vector.key),
    ).toBe(expected);
    expect(expected).toHaveLength(128);
  });

  it("gross_amount persis string payload ('100000' ≠ '100000.00')", () => {
    expect(computeSignature("order-101", "200", "100000", vector.key)).not.toBe(expected);
  });

  it("perbandingan timing-safe menolak salah/format aneh", () => {
    expect(signatureMatches(expected, expected.toUpperCase())).toBe(true);
    expect(signatureMatches(expected, expected.replace(/.$/, "0"))).toBe(expected.endsWith("0"));
    expect(signatureMatches(expected, "abc")).toBe(false);
    expect(signatureMatches(expected, undefined)).toBe(false);
  });
});

describe("redaksi", () => {
  it("menghapus secret, menyamarkan PII, mengganti server key literal", () => {
    const out = redactPayload(
      {
        Authorization: "Basic xxx",
        signature_key: "abc",
        server_key: SERVER_KEY,
        note: `key=${SERVER_KEY}`,
        customer_details: {
          email: "fulan@example.com",
          phone: "081234567890",
          first_name: "Fulan",
          last_name: "Bin Fulan",
        },
        upper: { EMAIL: "fulan@example.com", First_Name: "Fulan", AUTHORIZATION: "x" },
        n: 5n,
      },
      SERVER_KEY,
    );
    const s = JSON.stringify(out);
    expect(s).not.toContain(SERVER_KEY);
    expect(s).not.toContain("Basic xxx");
    expect(s).not.toContain("fulan@example.com");
    expect(out).toMatchObject({
      customer_details: {
        email: "f***@example.com",
        phone: "***7890",
        first_name: "F***",
        last_name: "B***",
      },
      upper: { EMAIL: "f***@example.com", First_Name: "F***", AUTHORIZATION: "[REDACTED]" },
      n: "5",
    });
  });
});

describe("adapter (fetch injeksi)", () => {
  it("createPayment: auth Basic, base sandbox, event create_request ter-redaksi", async () => {
    const { provider, calls, events } = setup([fixture("charge-bca")]);
    const r = await provider.createPayment(input("bca"));
    expect(r).toMatchObject({
      providerRef: "9aed5972-5b6a-401e-894b-a32c91ed1a3a",
      status: "pending",
      instruction: { kind: "virtual_account", vaNumber: "812785002530231" },
    });
    expect(calls[0]!.url).toBe("https://api.sandbox.midtrans.com/v2/charge");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from(`${SERVER_KEY}:`).toString("base64")}`);
    expect(headers.Accept).toBe("application/json");
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "create_request",
      orderId: ORDER,
      amountReported: 50000n,
    });
    const stored = JSON.stringify(events[0]!.payload);
    expect(stored).not.toContain(SERVER_KEY);
    expect(stored).not.toContain("Basic ");
    expect(stored).not.toContain("fulan@example.com");
  });

  it("base URL production bila isProduction", async () => {
    const calls: string[] = [];
    const p = createMidtransProvider({
      serverKey: "Mid-server-x",
      isProduction: true,
      recordEvent: async () => {},
      fetch: (async (u: string) => {
        calls.push(u);
        return new Response(JSON.stringify(fixture("status-settlement")));
      }) as unknown as typeof fetch,
    });
    await p.getPaymentStatus({ orderId: ORDER, providerRef: "" });
    expect(calls[0]).toBe(`https://api.midtrans.com/v2/${ORDER}/status`);
  });

  it("error 400 → validation + create_error; tidak di-retry", async () => {
    const { provider, events, fetchMock } = setup([fixture("error-400"), fixture("charge-bca")]);
    const err = await provider.createPayment(input("bca")).catch((e) => e);
    expect(err).toBeInstanceOf(MidtransError);
    expect(err.code).toBe("validation");
    expect(err.userMessage).toMatch(/metode lain/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events[0]!.eventType).toBe("create_error");
  });

  it("406 duplicate order → duplicate_order", async () => {
    const { provider } = setup([fixture("error-406")]);
    await expect(provider.createPayment(input("bca"))).rejects.toMatchObject({
      code: "duplicate_order",
    });
  });

  it("402 kanal belum aktif / 404 merchant → channel_unavailable", async () => {
    for (const status_code of ["402", "404"]) {
      const { provider } = setup([
        { status_code, status_message: "Payment channel is not activated." },
      ]);
      await expect(provider.createPayment(input("bri"))).rejects.toMatchObject({
        code: "channel_unavailable",
        userMessage: expect.stringMatching(/metode lain/),
      });
    }
  });

  it("HTTP 5xx dengan body tidak di-retry", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ status_code: "500" }), { status: 500 }),
    );
    const p = createMidtransProvider({
      serverKey: SERVER_KEY,
      isProduction: false,
      recordEvent: async () => {},
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(p.createPayment(input("bca"))).rejects.toMatchObject({
      code: "provider_unavailable",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  const pendingStatus = () => ({
    ...fixture("status-settlement"),
    status_code: "201",
    transaction_status: "pending",
    settlement_time: undefined,
    expiry_time: "2026-11-11 10:00:00",
  });
  const timeoutErr = () => Object.assign(new Error("timeout"), { name: "TimeoutError" });

  it("POST charge tidak pernah di-retry; error jaringan → pulih dari Get Status (pending)", async () => {
    const { provider, calls, events } = setup([new TypeError("fetch failed"), pendingStatus()]);
    const r = await provider.createPayment(input("bca"));
    expect(r).toMatchObject({
      providerRef: "9aed5972-5b6a-401e-894b-a32c91ed1a3a",
      status: "pending",
      instruction: { kind: "virtual_account", bankName: "BCA", vaNumber: "812785002530231" },
    });
    expect(calls.map((c) => c.init.method)).toEqual(["POST", "GET"]);
    expect(events.map((e) => e.eventType)).toEqual(["create_error", "status_check"]);
  });

  it("timeout charge + transaksi tidak ada di Midtrans → error asli timeout", async () => {
    const { provider, calls } = setup([timeoutErr(), fixture("status-404")]);
    await expect(provider.createPayment(input("bca"))).rejects.toMatchObject({ code: "timeout" });
    expect(calls.map((c) => c.init.method)).toEqual(["POST", "GET"]);
  });

  it("406 duplicate → pulih bila pending; bila sudah final → duplicate_order", async () => {
    const a = setup([fixture("error-406"), pendingStatus()]);
    await expect(a.provider.createPayment(input("bca"))).resolves.toMatchObject({
      status: "pending",
    });
    const b = setup([fixture("error-406"), fixture("status-settlement")]);
    await expect(b.provider.createPayment(input("bca"))).rejects.toMatchObject({
      code: "duplicate_order",
    });
  });

  it("pemulihan: nominal status beda → invalid_response; instruksi tak lengkap → duplicate_order", async () => {
    const a = setup([new TypeError("x"), { ...pendingStatus(), gross_amount: "1.00" }]);
    await expect(a.provider.createPayment(input("bca"))).rejects.toMatchObject({
      code: "invalid_response",
    });
    const b = setup([new TypeError("x"), { ...pendingStatus(), va_numbers: undefined }]);
    await expect(b.provider.createPayment(input("bca"))).rejects.toMatchObject({
      code: "duplicate_order",
    });
  });

  it("GET di-retry 1x pada jaringan/timeout; gagal 2x → error", async () => {
    const a = setup([timeoutErr(), fixture("status-settlement")]);
    await expect(
      a.provider.getPaymentStatus({ orderId: ORDER, providerRef: "" }),
    ).resolves.toMatchObject({ status: "paid" });
    expect(a.fetchMock).toHaveBeenCalledTimes(2);
    const b = setup([new TypeError("x"), new TypeError("x"), fixture("status-settlement")]);
    await expect(
      b.provider.getPaymentStatus({ orderId: ORDER, providerRef: "" }),
    ).rejects.toMatchObject({ code: "network" });
    expect(b.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("POST expire tidak di-retry; error jaringan → cek status (sudah final = selesai)", async () => {
    const a = setup([new TypeError("x"), { ...pendingStatus(), transaction_status: "expire" }]);
    await expect(
      a.provider.expirePayment({ orderId: ORDER, providerRef: "" }),
    ).resolves.toBeUndefined();
    expect(a.calls.map((c) => c.init.method)).toEqual(["POST", "GET"]);
    const b = setup([new TypeError("x"), pendingStatus()]);
    await expect(
      b.provider.expirePayment({ orderId: ORDER, providerRef: "" }),
    ).rejects.toMatchObject({
      code: "network",
    });
  });

  it("gagal membaca body (timeout/abort) → MidtransError", async () => {
    for (const [err, code] of [
      [timeoutErr(), "timeout"],
      [new TypeError("terminated"), "network"],
    ] as const) {
      const p = createMidtransProvider({
        serverKey: SERVER_KEY,
        isProduction: false,
        recordEvent: async () => {},
        fetch: (async () =>
          ({
            status: 200,
            text: () => Promise.reject(err),
          }) as unknown as Response) as typeof fetch,
      });
      await expect(p.getPaymentStatus({ orderId: ORDER, providerRef: "" })).rejects.toMatchObject({
        code,
      });
    }
  });

  it("order_id milik kita wajib UUID (tanpa request)", async () => {
    const { provider, fetchMock } = setup([]);
    for (const orderId of ["..", ".", "../v1/x", "abc"]) {
      await expect(provider.getPaymentStatus({ orderId, providerRef: "" })).rejects.toMatchObject({
        code: "validation",
      });
      await expect(provider.expirePayment({ orderId, providerRef: "" })).rejects.toMatchObject({
        code: "validation",
      });
    }
    await expect(provider.createPayment(input("bca", { paymentId: "x/y" }))).rejects.toMatchObject({
      code: "validation",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("charge dengan gross_amount berbeda ditolak", async () => {
    const { provider } = setup([{ ...fixture("charge-bca"), gross_amount: "1000.00" }]);
    await expect(provider.createPayment(input("bca"))).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("getPaymentStatus: settlement → paid + paidAt WIB + status_check", async () => {
    const { provider, events } = setup([fixture("status-settlement")]);
    const s = await provider.getPaymentStatus({ orderId: ORDER, providerRef: "" });
    expect(s).toMatchObject({
      status: "paid",
      paidAmount: 50000n,
      paidAt: new Date("2026-11-10T03:05:00Z"),
    });
    expect(JSON.stringify(s.raw)).not.toContain("abc123"); // signature_key diredaksi
    expect(events[0]).toMatchObject({ eventType: "status_check", statusReported: "settlement" });
  });

  it("getPaymentStatus: 404 di body HTTP 200 → not_found", async () => {
    const { provider } = setup([fixture("status-404")]);
    await expect(
      provider.getPaymentStatus({ orderId: ORDER, providerRef: "" }),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("expirePayment: 407 lalu cek status", async () => {
    const { provider, calls, events } = setup([
      fixture("expire-407"),
      { ...fixture("status-settlement"), status_code: "407", transaction_status: "expire" },
    ]);
    await provider.expirePayment({ orderId: ORDER, providerRef: "" });
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ["POST", `https://api.sandbox.midtrans.com/v2/${ORDER}/expire`],
      ["GET", `https://api.sandbox.midtrans.com/v2/${ORDER}/status`],
    ]);
    expect(events.map((e) => e.eventType)).toEqual(["expire_request", "status_check"]);
  });

  it("expirePayment: 412 dianggap final lalu cek status; 404 selesai", async () => {
    const a = setup([
      { status_code: "412", status_message: "not permitted" },
      fixture("status-settlement"),
    ]);
    await expect(
      a.provider.expirePayment({ orderId: ORDER, providerRef: "" }),
    ).resolves.toBeUndefined();
    expect(a.fetchMock).toHaveBeenCalledTimes(2);
    const b = setup([fixture("status-404")]);
    await expect(
      b.provider.expirePayment({ orderId: ORDER, providerRef: "" }),
    ).resolves.toBeUndefined();
    expect(b.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("getPaymentInstructions menghidrasi expiresAt dari JSONB", () => {
    const { provider } = setup([]);
    const i = provider.getPaymentInstructions({
      providerRef: "x",
      instruction: {
        kind: "qr",
        qrString: "000201",
        expiresAt: "2026-11-10T03:15:00.000Z" as unknown as Date,
      },
    });
    expect(i.expiresAt).toEqual(new Date("2026-11-10T03:15:00Z"));
  });
});

describe("verifyWebhook", () => {
  const notif = (over: Record<string, string> = {}) => {
    const base = {
      order_id: ORDER,
      status_code: "200",
      gross_amount: "50000.00",
      transaction_id: "9aed5972-5b6a-401e-894b-a32c91ed1a3a",
      transaction_status: "settlement",
      fraud_status: "accept",
      ...over,
    };
    const signature_key = computeSignature(
      base.order_id,
      base.status_code,
      base.gross_amount,
      SERVER_KEY,
    );
    return { ...base, signature_key, ...over };
  };
  const req = (body: unknown) => ({ headers: new Headers(), rawBody: JSON.stringify(body) });

  it("signature valid → cross-check API; status & nominal dari API", async () => {
    // Body webhook mengaku settlement, API bilang pending → API menang.
    const { provider, calls } = setup([
      { ...fixture("status-settlement"), status_code: "201", transaction_status: "pending" },
    ]);
    const v = await provider.verifyWebhook(req(notif()));
    expect(calls[0]!.url).toContain(`/v2/${ORDER}/status`);
    expect(v).toMatchObject({
      eventId: "9aed5972-5b6a-401e-894b-a32c91ed1a3a:settlement:200",
      orderId: ORDER,
      status: "pending",
      amount: 50000n,
    });
    expect(JSON.stringify(v.raw)).not.toContain(SERVER_KEY);
  });

  it("signature salah → ditolak tanpa memanggil API", async () => {
    const { provider, fetchMock } = setup([fixture("status-settlement")]);
    const bad = { ...notif(), gross_amount: "5000000.00" }; // nominal diubah setelah ditandatangani
    await expect(provider.verifyWebhook(req(bad))).rejects.toMatchObject({
      code: "invalid_signature",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([".", "..", "../x", "a/b", "x".repeat(51)])(
    "order_id notifikasi %s ditolak sebelum memanggil API",
    async (orderId) => {
      const { provider, fetchMock } = setup([fixture("status-settlement")]);
      await expect(provider.verifyWebhook(req(notif({ order_id: orderId })))).rejects.toMatchObject(
        {
          code: "invalid_signature",
        },
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("payload rusak → ditolak", async () => {
    const { provider } = setup([]);
    await expect(
      provider.verifyWebhook({ headers: new Headers(), rawBody: "{not json" }),
    ).rejects.toMatchObject({
      code: "invalid_signature",
    });
  });

  it("transaction_id notifikasi beda dari API → ditolak", async () => {
    const { provider } = setup([{ ...fixture("status-settlement"), transaction_id: "lain" }]);
    await expect(provider.verifyWebhook(req(notif()))).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});

describe("env Midtrans", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@localhost/db",
    DATABASE_URL_UNPOOLED: "postgres://u:p@localhost/db",
    AUTH_SECRET: "x".repeat(32),
  };
  it("development menolak MIDTRANS_IS_PRODUCTION=true", () => {
    expect(() => parseServerEnv({ ...base, MIDTRANS_IS_PRODUCTION: "true" })).toThrow(
      /MIDTRANS_IS_PRODUCTION/,
    );
  });
  it("sandbox wajib prefix SB-Mid-server-/SB-Mid-client- (tanpa membocorkan nilai)", () => {
    try {
      parseServerEnv({
        ...base,
        MIDTRANS_SERVER_KEY: "Mid-server-PRODVALUE",
        MIDTRANS_CLIENT_KEY: "SB-Mid-client-a",
      });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toContain("MIDTRANS_SERVER_KEY");
      expect(String(e)).not.toContain("PRODVALUE");
    }
    expect(
      parseServerEnv({
        ...base,
        MIDTRANS_SERVER_KEY: "SB-Mid-server-a",
        MIDTRANS_CLIENT_KEY: "SB-Mid-client-a",
      }).MIDTRANS_SERVER_KEY,
    ).toBe("SB-Mid-server-a");
  });
});
