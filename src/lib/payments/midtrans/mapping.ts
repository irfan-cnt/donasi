import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { CreatePaymentInput, PaymentInstruction, PaymentStatus } from "../types";
import { MidtransError } from "./errors";

// Fungsi murni Midtrans Core API (docs/03-technical/payment-architecture.md §3).

export const SANDBOX_BASE_URL = "https://api.sandbox.midtrans.com";
export const PRODUCTION_BASE_URL = "https://api.midtrans.com";

export function baseUrl(isProduction: boolean): string {
  return isProduction ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

const VA_BANKS = {
  bca: "BCA",
  bni: "BNI",
  bri: "BRI",
  cimb: "CIMB Niaga",
  permata: "Permata",
} as const;
type VaBank = keyof typeof VA_BANKS;

/** Kanal internal (payment_methods.provider_channel) → bentuk charge Midtrans. */
export type ChargeKind =
  | { paymentType: "qris" }
  | { paymentType: "gopay" }
  | { paymentType: "shopeepay" }
  | { paymentType: "bank_transfer"; bank: Exclude<VaBank, "permata"> }
  | { paymentType: "permata" }
  | { paymentType: "echannel" };

export function chargeKindForChannel(channel: string): ChargeKind {
  switch (channel) {
    case "qris":
      return { paymentType: "qris" };
    case "gopay":
      return { paymentType: "gopay" };
    case "shopeepay":
      return { paymentType: "shopeepay" };
    case "bca":
    case "bni":
    case "bri":
    case "cimb":
      return { paymentType: "bank_transfer", bank: channel };
    // Docs resmi (Bank Transfer → Permata VA): payment_type "permata", tanpa objek bank_transfer.
    case "permata":
      return { paymentType: "permata" };
    case "echannel":
      return { paymentType: "echannel" };
    default:
      throw new MidtransError("validation", `kanal tidak didukung: ${channel}`);
  }
}

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "yyyy-MM-dd HH:mm:ss +0700" (WIB, tanpa DST). */
export function formatOrderTime(d: Date): string {
  const iso = new Date(d.getTime() + JAKARTA_OFFSET_MS).toISOString(); // yyyy-MM-ddTHH:mm:ss.sssZ
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} +0700`;
}

/** "yyyy-MM-dd HH:mm:ss" (WIB, format expiry_time/transaction_time Midtrans) → Date. */
export function parseMidtransTime(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const d = new Date(`${m[1]}T${m[2]}+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** gross_amount Midtrans ("10000.00" / "10000" / 10000) → bigint rupiah; pecahan ditolak. */
export function parseGrossAmount(value: unknown): bigint {
  const s = typeof value === "number" ? String(value) : value;
  if (typeof s !== "string" || !/^\d{1,13}(\.0{1,2})?$/.test(s)) {
    throw new MidtransError("invalid_response", "gross_amount tidak valid");
  }
  return BigInt(s.split(".")[0]!);
}

function amountToNumber(amount: bigint): number {
  if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new MidtransError("validation", "nominal di luar batas");
  }
  return Number(amount);
}

const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** Body POST /v2/charge. */
export function buildChargeBody(input: CreatePaymentInput, now: Date): Record<string, unknown> {
  const kind = chargeKindForChannel(input.method.providerChannel);
  const gross = amountToNumber(input.amount);
  const body: Record<string, unknown> = {
    payment_type: kind.paymentType,
    transaction_details: { order_id: input.paymentId, gross_amount: gross },
    customer_details: {
      first_name: truncate(input.customer.name, 255),
      email: input.customer.email,
      ...(input.customer.phone ? { phone: input.customer.phone } : {}),
    },
    item_details: [
      {
        id: truncate(input.campaignId ?? input.transactionCode, 50),
        name: truncate(input.description, 50),
        price: gross,
        quantity: 1,
      },
    ],
    custom_expiry: {
      order_time: formatOrderTime(now),
      expiry_duration: input.expiresInMinutes,
      unit: "minute",
    },
  };
  switch (kind.paymentType) {
    case "bank_transfer":
      body.bank_transfer = { bank: kind.bank };
      break;
    case "echannel":
      // Mandiri: bill_info1 ≤10 karakter, bill_info2 ≤30 (lebihnya dipotong Mandiri).
      body.echannel = { bill_info1: "Donasi", bill_info2: truncate(input.transactionCode, 30) };
      break;
    case "qris":
      body.qris = { acquirer: "gopay" };
      break;
    case "gopay":
      body.gopay = { enable_callback: true, callback_url: input.successRedirectUrl };
      break;
    case "shopeepay":
      body.shopeepay = { callback_url: input.successRedirectUrl };
      break;
  }
  return body;
}

export interface MappedStatus {
  status: PaymentStatus;
  needsReview: boolean;
  /** Midtrans `partial_refund` (P25): jangan kurangi total — butuh review. */
  partialRefund?: boolean;
}

/**
 * transaction_status (+ fraud_status) → status internal. Status tak dikenal (authorize,
 * chargeback, dll.) melempar `unmapped_status` agar tidak pernah diterapkan diam-diam.
 */
export function mapTransactionStatus(
  transactionStatus: unknown,
  fraudStatus?: unknown,
): MappedStatus {
  const ts = typeof transactionStatus === "string" ? transactionStatus.toLowerCase() : "";
  const fs = typeof fraudStatus === "string" ? fraudStatus.toLowerCase() : undefined;
  switch (ts) {
    case "settlement":
      return { status: "paid", needsReview: false };
    case "capture":
      if (fs === "accept") return { status: "paid", needsReview: false };
      if (fs === "challenge") return { status: "pending", needsReview: true };
      if (fs === "deny") return { status: "failed", needsReview: false };
      throw new MidtransError("unmapped_status", `capture dengan fraud_status ${String(fs)}`);
    case "pending":
      return { status: "pending", needsReview: false };
    case "expire":
      return { status: "expired", needsReview: false };
    case "deny":
    case "failure":
      return { status: "failed", needsReview: false };
    case "cancel":
      return { status: "cancelled", needsReview: false };
    case "refund":
      return { status: "refunded", needsReview: true };
    // P25 (OD-28): nominal refund parsial tidak diketahui sistem → tidak pernah diterapkan.
    case "partial_refund":
      return { status: "refunded", needsReview: true, partialRefund: true };
    default:
      throw new MidtransError("unmapped_status", `transaction_status ${ts || "(kosong)"}`);
  }
}

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

function actionUrl(res: Json, name: string): string | undefined {
  const actions = Array.isArray(res.actions) ? (res.actions as Json[]) : [];
  return str(actions.find((a) => a?.name === name)?.url);
}

/**
 * Respons charge/status → PaymentInstruction. QR selalu dari `qr_string` (dirender sendiri);
 * URL gambar QR Midtrans (`generate-qr-code`) sengaja tidak dipakai.
 */
export function normalizeInstruction(
  channel: string,
  res: Json,
  fallbackExpiresAt: Date,
): PaymentInstruction {
  const kind = chargeKindForChannel(channel);
  const expiresAt = parseMidtransTime(res.expiry_time) ?? fallbackExpiresAt;
  const missing = (field: string) =>
    new MidtransError("invalid_response", `respons ${kind.paymentType} tanpa ${field}`);

  switch (kind.paymentType) {
    case "bank_transfer": {
      const vas = Array.isArray(res.va_numbers) ? (res.va_numbers as Json[]) : [];
      const va = vas.find((v) => v?.bank === kind.bank) ?? vas[0];
      const vaNumber = str(va?.va_number);
      if (!vaNumber) throw missing("va_numbers");
      return { kind: "virtual_account", bankName: VA_BANKS[kind.bank], vaNumber, expiresAt };
    }
    case "permata": {
      const vaNumber = str(res.permata_va_number);
      if (!vaNumber) throw missing("permata_va_number");
      return { kind: "virtual_account", bankName: VA_BANKS.permata, vaNumber, expiresAt };
    }
    case "echannel": {
      const billerCode = str(res.biller_code);
      const billKey = str(res.bill_key);
      if (!billerCode || !billKey) throw missing("biller_code/bill_key");
      return {
        kind: "payment_code",
        bankName: "Mandiri",
        billerCode,
        billKey,
        paymentCode: billKey,
        expiresAt,
      };
    }
    case "qris": {
      const qrString = str(res.qr_string);
      if (!qrString) throw missing("qr_string");
      return { kind: "qr", qrString, expiresAt };
    }
    case "gopay": {
      const paymentUrl = actionUrl(res, "deeplink-redirect");
      const qrString = str(res.qr_string);
      if (!paymentUrl && !qrString) throw missing("deeplink-redirect");
      return { kind: qrString ? "qr" : "redirect", qrString, paymentUrl, expiresAt };
    }
    case "shopeepay": {
      const paymentUrl = actionUrl(res, "deeplink-redirect");
      if (!paymentUrl) throw missing("deeplink-redirect");
      return { kind: "redirect", paymentUrl, expiresAt };
    }
  }
}

/** SHA512(order_id + status_code + gross_amount + server_key), hex. */
export function computeSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");
}

export function signatureMatches(expectedHex: string, receivedHex: unknown): boolean {
  if (typeof receivedHex !== "string" || !/^[0-9a-fA-F]{128}$/.test(receivedHex)) return false;
  return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(receivedHex, "hex"));
}
