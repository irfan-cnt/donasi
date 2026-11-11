import "server-only";
import { z } from "zod";
import type { Logger } from "@/lib/logger";
import { logger as rootLogger } from "@/lib/logger";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentInstruction,
  PaymentProvider,
  ProviderPaymentRef,
  StatusResult,
  VerifiedWebhook,
} from "../types";
import { errorFromStatusCode, MidtransError } from "./errors";
import { type MidtransEventType, type RecordMidtransEvent } from "./event-log";
import {
  baseUrl,
  buildChargeBody,
  computeSignature,
  mapTransactionStatus,
  normalizeInstruction,
  parseGrossAmount,
  parseMidtransTime,
  signatureMatches,
} from "./mapping";
import { redactPayload } from "./redact";

export const MIDTRANS_TIMEOUT_MS = 10_000;

export interface MidtransDeps {
  serverKey: string;
  isProduction: boolean;
  recordEvent: RecordMidtransEvent;
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  logger?: Logger;
  /** Non-production saja: header X-Override-Notification pada charge (URL https). */
  notificationUrlOverride?: string;
}

type Json = Record<string, unknown>;

/** order_id aman untuk path URL (karakter unreserved RFC 3986, bukan "." / ".."). */
const SAFE_ORDER_ID = /^[A-Za-z0-9._~-]{1,50}$/;
const safeOrderId = z
  .string()
  .regex(SAFE_ORDER_ID)
  .refine((v) => v !== "." && v !== "..");
const uuidSchema = z.uuid();

/** order_id milik kita (payments.id) wajib UUID. */
function assertOwnOrderId(orderId: string): void {
  if (!uuidSchema.safeParse(orderId).success) {
    throw new MidtransError("validation", "order_id bukan UUID");
  }
}

const notificationSchema = z.object({
  order_id: safeOrderId,
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().min(1).max(30),
  signature_key: z.string(),
  transaction_id: z.string().min(1).max(100),
  transaction_status: z.string().min(1).max(50),
});

const RECOVERABLE = new Set(["network", "timeout", "duplicate_order"]);

const isTimeout = (e: unknown) =>
  e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

export function createMidtransProvider(deps: MidtransDeps): PaymentProvider {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? MIDTRANS_TIMEOUT_MS;
  const log = (deps.logger ?? rootLogger).child({ provider: "midtrans" });
  const base = baseUrl(deps.isProduction);
  const authorization = `Basic ${Buffer.from(`${deps.serverKey}:`).toString("base64")}`;
  const redact = (v: unknown) => redactPayload(v, deps.serverKey);
  // Pertahanan berlapis selain env.ts: tidak pernah di mode production, hanya https.
  const overrideNotification =
    !deps.isProduction && deps.notificationUrlOverride?.startsWith("https://")
      ? deps.notificationUrlOverride
      : undefined;

  async function record(
    eventType: MidtransEventType,
    orderId: string,
    payload: unknown,
    extra: { status?: string; amount?: bigint; error?: string } = {},
  ) {
    try {
      await deps.recordEvent({
        eventType,
        orderId,
        payload: redact(payload),
        statusReported: extra.status,
        amountReported: extra.amount,
        errorMessage: extra.error,
      });
    } catch (e) {
      // Pencatatan gagal tidak boleh menggagalkan pembayaran; tetap terlihat di log.
      log.error("payment_event_record_failed", { eventType, orderId, err: String(e) });
    }
  }

  /**
   * Satu panggilan HTTP. POST (charge/expire) TIDAK PERNAH di-retry — request mungkin sudah
   * diterima Midtrans; pemulihan lewat Get Status. GET di-retry 1x bila fetch melempar
   * sebelum ada respons (jaringan/timeout).
   */
  async function call(method: "GET" | "POST", path: string, body?: Json) {
    const init = (): RequestInit => ({
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authorization,
        ...(overrideNotification && path === "/v2/charge"
          ? { "X-Override-Notification": overrideNotification }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const toError = (e: unknown) =>
      new MidtransError(isTimeout(e) ? "timeout" : "network", `${method} ${path}`);
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, init());
    } catch (e) {
      if (method === "POST") throw toError(e);
      log.warn("midtrans_network_retry", { method, path, err: String(e) });
      try {
        res = await doFetch(`${base}${path}`, init());
      } catch (e2) {
        throw toError(e2);
      }
    }
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      throw toError(e);
    }
    let json: Json;
    try {
      json = JSON.parse(text) as Json;
    } catch {
      throw errorFromStatusCode(String(res.status >= 400 ? res.status : 502), "respons bukan JSON");
    }
    // Midtrans sering membalas HTTP 200 dengan status_code error di body.
    const statusCode = typeof json.status_code === "string" ? json.status_code : String(res.status);
    return { httpStatus: res.status, statusCode, json };
  }

  const isSuccess = (code: string) => /^2\d\d$/.test(code) || code === "407";

  function describe(json: Json): string {
    const msgs = Array.isArray(json.validation_messages) ? json.validation_messages.join("; ") : "";
    return [json.status_message, msgs].filter(Boolean).join(" — ").slice(0, 500);
  }

  async function getStatus(orderId: string): Promise<StatusResult> {
    if (!safeOrderId.safeParse(orderId).success) {
      throw new MidtransError("validation", "order_id tidak valid");
    }
    const path = `/v2/${encodeURIComponent(orderId)}/status`;
    let r;
    try {
      r = await call("GET", path);
    } catch (e) {
      await record(
        "status_check",
        orderId,
        { request: { method: "GET", path } },
        { error: String(e) },
      );
      throw e;
    }
    const payload = {
      request: { method: "GET", path },
      httpStatus: r.httpStatus,
      response: r.json,
    };
    if (!isSuccess(r.statusCode)) {
      const err = errorFromStatusCode(r.statusCode, describe(r.json));
      await record("status_check", orderId, payload, { error: err.message });
      throw err;
    }
    if (r.json.order_id !== orderId) {
      const err = new MidtransError("invalid_response", "order_id status tidak cocok");
      await record("status_check", orderId, payload, { error: err.message });
      throw err;
    }
    let mapped, amount;
    try {
      mapped = mapTransactionStatus(r.json.transaction_status, r.json.fraud_status);
      amount = parseGrossAmount(r.json.gross_amount);
    } catch (e) {
      await record("status_check", orderId, payload, {
        status: String(r.json.transaction_status),
        error: String(e),
      });
      throw e;
    }
    await record("status_check", orderId, payload, {
      status: String(r.json.transaction_status),
      amount,
    });
    const providerRef = typeof r.json.transaction_id === "string" ? r.json.transaction_id : "";
    return {
      providerRef,
      status: mapped.status,
      needsReview: mapped.needsReview || undefined,
      partialRefund: mapped.partialRefund || undefined,
      paidAmount: mapped.status === "paid" ? amount : undefined,
      paidAt:
        mapped.status === "paid"
          ? (parseMidtransTime(r.json.settlement_time) ??
            parseMidtransTime(r.json.transaction_time) ??
            now())
          : undefined,
      raw: redact(r.json),
    };
  }

  async function charge(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const startedAt = now();
    const body = buildChargeBody(input, startedAt);
    const request = { method: "POST", path: "/v2/charge", body };
    let r;
    try {
      r = await call("POST", "/v2/charge", body);
    } catch (e) {
      await record("create_error", input.paymentId, { request }, { error: String(e) });
      throw e;
    }
    const payload = { request, httpStatus: r.httpStatus, response: r.json };
    try {
      if (!isSuccess(r.statusCode)) {
        // Charge 404 (mis. "Merchant pop id is not found" GoPay) = kanal belum disiapkan.
        if (r.statusCode === "404") {
          throw new MidtransError("channel_unavailable", describe(r.json), r.statusCode);
        }
        throw errorFromStatusCode(r.statusCode, describe(r.json));
      }
      if (r.json.order_id !== input.paymentId) {
        throw new MidtransError("invalid_response", "order_id charge tidak cocok");
      }
      if (parseGrossAmount(r.json.gross_amount) !== input.amount) {
        throw new MidtransError("invalid_response", "gross_amount charge tidak cocok");
      }
      const providerRef = r.json.transaction_id;
      if (typeof providerRef !== "string" || !providerRef) {
        throw new MidtransError("invalid_response", "transaction_id kosong");
      }
      const mapped = mapTransactionStatus(r.json.transaction_status, r.json.fraud_status);
      if (mapped.status !== "pending") {
        throw new MidtransError("invalid_response", `charge berstatus ${mapped.status}`);
      }
      const fallbackExpiry = new Date(startedAt.getTime() + input.expiresInMinutes * 60_000);
      const instruction = normalizeInstruction(
        input.method.providerChannel,
        r.json,
        fallbackExpiry,
      );
      await record("create_request", input.paymentId, payload, {
        status: String(r.json.transaction_status),
        amount: input.amount,
      });
      return { providerRef, status: "pending", instruction };
    } catch (e) {
      await record("create_error", input.paymentId, payload, { error: String(e) });
      throw e;
    }
  }

  async function recoverCharge(
    input: CreatePaymentInput,
    original: MidtransError,
  ): Promise<CreatePaymentResult> {
    let st: StatusResult;
    try {
      st = await getStatus(input.paymentId);
    } catch {
      throw original; // charge tidak ditemukan / status gagal → hasil asli (bisa dicoba lagi)
    }
    if (st.status !== "pending") {
      throw new MidtransError("duplicate_order", `charge sudah berstatus ${st.status}`);
    }
    const raw = st.raw as Json;
    try {
      if (parseGrossAmount(raw.gross_amount) !== input.amount) {
        throw new MidtransError("invalid_response", "gross_amount status tidak cocok");
      }
      const fallbackExpiry = new Date(now().getTime() + input.expiresInMinutes * 60_000);
      const instruction = normalizeInstruction(input.method.providerChannel, raw, fallbackExpiry);
      log.warn("midtrans_charge_recovered", { orderId: input.paymentId, cause: original.code });
      return { providerRef: st.providerRef, status: "pending", instruction };
    } catch (e) {
      throw e instanceof MidtransError &&
        e.code === "invalid_response" &&
        e.message.includes("gross_amount status")
        ? e
        : new MidtransError("duplicate_order", "instruksi charge lama tidak dapat dipulihkan");
    }
  }

  /** Zod ketat + signature SHA512 timing-safe (murni, sinkron). null = tidak valid. */
  function parseSignedNotification(rawBody: string): z.infer<typeof notificationSchema> | null {
    let body: z.infer<typeof notificationSchema>;
    try {
      body = notificationSchema.parse(JSON.parse(rawBody));
    } catch {
      return null;
    }
    const expected = computeSignature(
      body.order_id,
      body.status_code,
      body.gross_amount,
      deps.serverKey,
    );
    return signatureMatches(expected, body.signature_key) ? body : null;
  }

  return {
    code: "midtrans",

    async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
      assertOwnOrderId(input.paymentId);
      try {
        return await charge(input);
      } catch (e) {
        // Hasil POST tidak pasti (jaringan/timeout) atau order_id sudah ada (406):
        // jangan charge ulang, pulihkan dari Get Status.
        if (e instanceof MidtransError && RECOVERABLE.has(e.code)) {
          return recoverCharge(input, e);
        }
        throw e;
      }
    },

    async getPaymentStatus(ref: ProviderPaymentRef): Promise<StatusResult> {
      assertOwnOrderId(ref.orderId);
      return getStatus(ref.orderId);
    },

    /**
     * Verifikasi notifikasi: signature SHA512 timing-safe, LALU cross-check Get Status.
     * Status & nominal yang dikembalikan berasal dari API (kebenaran), bukan dari body webhook.
     */
    checkWebhookSignature(req: { headers: Headers; rawBody: string }): boolean {
      return parseSignedNotification(req.rawBody) !== null;
    },

    async verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<VerifiedWebhook> {
      const body = parseSignedNotification(req.rawBody);
      if (!body) {
        throw new MidtransError("invalid_signature", "payload/signature notifikasi tidak valid");
      }
      const status = await getStatus(body.order_id);
      if (status.providerRef && status.providerRef !== body.transaction_id) {
        throw new MidtransError("invalid_response", "transaction_id notifikasi ≠ status API");
      }
      const raw = status.raw as Json;
      return {
        eventId: `${body.transaction_id}:${body.transaction_status}:${body.status_code}`,
        providerRef: status.providerRef || body.transaction_id,
        orderId: body.order_id,
        status: status.status,
        amount: parseGrossAmount(raw.gross_amount),
        paidAt: status.paidAt,
        needsReview: status.needsReview,
        raw: { notification: redact(JSON.parse(req.rawBody)), status: raw },
      };
    },

    getPaymentInstructions(payment: {
      providerRef: string;
      instruction: PaymentInstruction;
    }): PaymentInstruction {
      // Instruksi disimpan saat charge (payments.instruction); JSONB mengubah Date jadi string.
      const i = payment.instruction;
      return { ...i, expiresAt: new Date(i.expiresAt) };
    },

    async expirePayment(ref: ProviderPaymentRef): Promise<void> {
      assertOwnOrderId(ref.orderId);
      const path = `/v2/${encodeURIComponent(ref.orderId)}/expire`;
      const request = { method: "POST", path };
      let r;
      try {
        r = await call("POST", path);
      } catch (e) {
        await record("expire_request", ref.orderId, { request }, { error: String(e) });
        // POST tidak di-retry; cek apakah transaksi sudah tidak pending.
        const st = await getStatus(ref.orderId).catch(() => null);
        if (st && st.status !== "pending") return;
        throw e;
      }
      const payload = { request, httpStatus: r.httpStatus, response: r.json };
      // 407 = berhasil di-expire; 404/412 = sudah final/tidak ada → cukup cek status.
      const final = isSuccess(r.statusCode) || r.statusCode === "404" || r.statusCode === "412";
      if (!final) {
        const err = errorFromStatusCode(r.statusCode, describe(r.json));
        await record("expire_request", ref.orderId, payload, { error: err.message });
        throw err;
      }
      await record("expire_request", ref.orderId, payload, {
        status:
          typeof r.json.transaction_status === "string" ? r.json.transaction_status : undefined,
      });
      if (r.statusCode === "404") return; // tidak pernah ada di Midtrans; status juga 404
      await getStatus(ref.orderId);
    },
  };
}
