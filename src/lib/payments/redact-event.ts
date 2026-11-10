import "server-only";
import { getEnv } from "@/lib/env";
import { maskEmail, maskPhone } from "@/lib/format/mask";
import { redactPayload } from "./midtrans/redact";

// Redaksi payload payment_events KHUSUS TAMPILAN admin (F-29; /admin/log-pembayaran hanya butuh
// transactions.read). Tidak mengubah data tersimpan maupun yang dibaca webhook/reconcile.
// - Rahasia (signature/token/secret/server key) → [REDACTED] (redactPayload).
// - Data kartu, rekening/kode bayar (VA, bill key, payment code), alamat → [REDACTED].
// - Email/telepon → maskEmail/maskPhone yang sama dengan halaman lain.
// Idempoten.

const HIDDEN_KEYS =
  /(card|cvv|cvn|pan$|saved_token|account_number|account_no|bank_account|approval_code|^eci$|three_ds|3ds|callback_token|x-callback|address|city|postal_code|zip|va_number|bill_key|biller_code|payment_code)/i;
const EMAIL_KEYS = /(^|_)email$/i;
const PHONE_KEYS = /(^|_)(phone|phone_number|msisdn|mobile)$/i;

export function redactEventPayload(payload: unknown): unknown {
  const walk = (v: unknown, key?: string): unknown => {
    if (key && HIDDEN_KEYS.test(key)) return "[REDACTED]";
    if (typeof v === "string" && key && EMAIL_KEYS.test(key)) return maskEmail(v);
    if (typeof v === "string" && key && PHONE_KEYS.test(key)) return maskPhone(v);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  // Mask dulu dari nilai asli (maskEmail lebih ketat dari masker lama), lalu redaksi rahasia.
  return redactPayload(walk(payload), getEnv().MIDTRANS_SERVER_KEY ?? undefined);
}
