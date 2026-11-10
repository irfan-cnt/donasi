import { describe, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { createMidtransProvider } from "@/lib/payments/midtrans/provider";
import {
  EVENT_DEDUP_CONSTRAINT,
  handleMidtransWebhook,
  isEventDuplicateError,
  webhookShape,
  type MidtransWebhookDeps,
} from "@/lib/payments/webhook/midtrans-webhook";

// Bagian handler yang tidak menyentuh DB (penolakan dini) + override URL notifikasi.

const log = createLogger({ test: "webhook-unit" });
const deps = (over: Partial<MidtransWebhookDeps> = {}): MidtransWebhookDeps => ({
  provider: null,
  publishPaid: vi.fn(async () => {}),
  revalidateCampaign: vi.fn(async () => {}),
  onRejectedSignature: vi.fn(async () => false),
  log,
  ...over,
});
const call = (rawBody: string, d = deps()) =>
  handleMidtransWebhook({ headers: new Headers(), rawBody }, d);

const valid = {
  order_id: "0194f0a0-0000-7000-8000-000000000001",
  transaction_id: "t-1",
  transaction_status: "settlement",
  status_code: "200",
  gross_amount: "50000.00",
  signature_key: "x",
};

describe("handleMidtransWebhook — penolakan dini (tanpa DB)", () => {
  it("body bukan JSON → 400", async () => {
    expect(await call("not json")).toMatchObject({ status: 400, body: { result: "invalid_json" } });
  });

  it.each([
    [{}],
    [{ ...valid, order_id: "" }],
    [{ ...valid, gross_amount: 50000 }],
    [{ ...valid, signature_key: undefined }],
    [[valid]],
  ])("bentuk payload salah → 400 (%#)", async (body) => {
    expect(await call(JSON.stringify(body))).toMatchObject({
      status: 400,
      body: { result: "invalid_payload" },
    });
  });

  it("provider tidak terkonfigurasi → 503 (Midtrans retry)", async () => {
    expect(await call(JSON.stringify(valid))).toMatchObject({ status: 503 });
  });

  it("field tambahan Midtrans diterima oleh skema bentuk", () => {
    expect(
      webhookShape.safeParse({ ...valid, va_numbers: [], fraud_status: "accept" }).success,
    ).toBe(true);
  });
});

describe("signature lokal sebelum DB", () => {
  const provider = createMidtransProvider({
    serverKey: "SB-Mid-server-X",
    isProduction: false,
    recordEvent: async () => {
      throw new Error("tidak boleh dipanggil");
    },
    fetch: (async () => {
      throw new Error("tidak boleh dipanggil");
    }) as unknown as typeof fetch,
  });

  it("signature salah → 401 tanpa DB/API; limit terlampaui → 429", async () => {
    const body = JSON.stringify({ ...valid, signature_key: "f".repeat(128) });
    expect(await call(body, deps({ provider }))).toMatchObject({ status: 401 });
    expect(
      await call(body, deps({ provider, onRejectedSignature: async () => true })),
    ).toMatchObject({ status: 429 });
    // Redis error → fail-open (tetap 401, bukan 5xx).
    expect(
      await call(
        body,
        deps({
          provider,
          onRejectedSignature: async () => {
            throw new Error("redis down");
          },
        }),
      ),
    ).toMatchObject({ status: 401 });
  });

  it("checkWebhookSignature: benar/salah", async () => {
    const { computeSignature } = await import("@/lib/payments/midtrans/mapping");
    const sig = computeSignature(valid.order_id, "200", "50000.00", "SB-Mid-server-X");
    const ok = (s: string) =>
      provider.checkWebhookSignature({
        headers: new Headers(),
        rawBody: JSON.stringify({ ...valid, signature_key: s }),
      });
    expect(ok(sig)).toBe(true);
    expect(ok(sig.replace(/.$/, sig.endsWith("0") ? "1" : "0"))).toBe(false);
  });
});

describe("isEventDuplicateError", () => {
  const wrap = (code: string, constraint?: string) =>
    Object.assign(new Error("Failed query"), { cause: { code, constraint } });
  it("hanya 23505 pada constraint dedup event", () => {
    expect(isEventDuplicateError(wrap("23505", EVENT_DEDUP_CONSTRAINT))).toBe(true);
    expect(isEventDuplicateError(wrap("23505", "payments_provider_ref_key"))).toBe(false);
    expect(isEventDuplicateError(wrap("23505"))).toBe(false);
    expect(isEventDuplicateError(wrap("40001", EVENT_DEDUP_CONSTRAINT))).toBe(false);
  });
});

describe("X-Override-Notification", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@h/db",
    DATABASE_URL_UNPOOLED: "postgres://u:p@h/db",
    AUTH_SECRET: "x".repeat(32),
  };

  it("env: https di development/preview diterima; http & production ditolak", () => {
    expect(
      parseServerEnv({
        ...base,
        MIDTRANS_NOTIFICATION_URL_OVERRIDE: "https://pr-1.example.app/api/webhooks/midtrans",
      }).MIDTRANS_NOTIFICATION_URL_OVERRIDE,
    ).toContain("https://");
    expect(() =>
      parseServerEnv({ ...base, MIDTRANS_NOTIFICATION_URL_OVERRIDE: "http://localhost:3000/x" }),
    ).toThrow(/MIDTRANS_NOTIFICATION_URL_OVERRIDE/);
    expect(() =>
      parseServerEnv({
        ...base,
        APP_ENV: "production",
        MIDTRANS_IS_PRODUCTION: "true",
        MIDTRANS_NOTIFICATION_URL_OVERRIDE: "https://x.example/api/webhooks/midtrans",
      }),
    ).toThrow(/MIDTRANS_NOTIFICATION_URL_OVERRIDE: tidak boleh diisi di production/);
  });

  const charge = async (isProduction: boolean, override?: string) => {
    const headers: Headers[] = [];
    const orderId = "0194f0a0-0000-7000-8000-000000000001";
    const fetchMock = vi.fn(async (_u: unknown, init?: RequestInit) => {
      headers.push(new Headers(init!.headers));
      return new Response(
        JSON.stringify({
          status_code: "201",
          order_id: orderId,
          transaction_id: "t-1",
          gross_amount: "50000.00",
          transaction_status: "pending",
          va_numbers: [{ bank: "bca", va_number: "123" }],
        }),
      );
    });
    const p = createMidtransProvider({
      serverKey: isProduction ? "Mid-server-PROD" : "SB-Mid-server-X",
      isProduction,
      recordEvent: async () => {},
      fetch: fetchMock as unknown as typeof fetch,
      notificationUrlOverride: override,
    });
    await p.createPayment({
      paymentId: orderId,
      transactionCode: "TK-261110-ABC123",
      amount: 50_000n,
      method: { code: "bca_va", type: "virtual_account", providerChannel: "bca" },
      customer: { name: "A", email: "a@example.com" },
      description: "uji",
      expiresInMinutes: 60,
      successRedirectUrl: "https://example.org/x",
    });
    return headers[0]!.get("x-override-notification");
  };

  it("header dikirim pada charge sandbox bila diisi https; tidak di production/http", async () => {
    const url = "https://pr-1.example.app/api/webhooks/midtrans";
    expect(await charge(false, url)).toBe(url);
    expect(await charge(false)).toBeNull();
    expect(await charge(false, "http://insecure.example/x")).toBeNull();
    expect(await charge(true, url)).toBeNull();
  });
});
