import { z } from "zod";

// Body job QStash → /api/jobs/notify (P16). Kontrak publish: payment-architecture.md §3b/§5b/§6a,
// notification-architecture.md. Tidak pernah berisi PII/token — handler memuat data dari DB.

const uuid = z.uuid();
/** Referensi dedup alert (tanggal, jam, id) — dibatasi agar aman dipakai di dedup_key. */
const ref = z.string().regex(/^[A-Za-z0-9:_-]{1,80}$/);

export const DONOR_EVENTS = [
  "payment.pending",
  "payment.paid",
  "payment.failed",
  "payment.expired",
] as const;

export const donorJobSchema = z.object({
  event: z.enum(DONOR_EVENTS),
  transactionId: uuid,
  paymentId: uuid,
});

export const receiptJobSchema = z.object({
  event: z.literal("receipt.issued"),
  transactionId: uuid,
});

/** Event donor yang punya template WhatsApp (notification-architecture.md §Event → kanal). */
export const WHATSAPP_EVENTS = ["payment.pending", "payment.paid", "payment.failed"] as const;

/**
 * P17: kirim WA sebagai job QStash terpisah (flow control global FONNTE_MIN_DELAY_MS) agar email
 * tidak tertunda. Baris notification_logs `{source}:…:whatsapp` sudah dibuat (queued) oleh job asal.
 */
export const whatsappJobSchema = z.object({
  event: z.literal("whatsapp.send"),
  source: z.enum(WHATSAPP_EVENTS),
  transactionId: uuid,
  paymentId: uuid,
});

export const ADMIN_ALERT_KINDS = ["reconciliation", "payment", "email_quota", "whatsapp"] as const;

export const adminAlertJobSchema = z.object({
  event: z.literal("admin.alert"),
  kind: z.enum(ADMIN_ALERT_KINDS),
  /** reconciliation/email_quota: tanggal WIB (YYYY-MM-DD) — juga kunci dedup. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** payment: kunci dedup (mis. paymentId atau jam). */
  ref: ref.optional(),
  /** payment: jenis alert (amount_mismatch, needs_review, provider_auth, …). */
  alert: z
    .string()
    .regex(/^[a-z0-9_]{1,40}$/)
    .optional(),
  paymentId: uuid.optional(),
  transactionId: uuid.optional(),
  counts: z.record(z.string().regex(/^[A-Za-z0-9_]{1,40}$/), z.number().int()).optional(),
});

export const notifyJobSchema = z.discriminatedUnion("event", [
  donorJobSchema,
  receiptJobSchema,
  adminAlertJobSchema,
  whatsappJobSchema,
]);

export type DonorJob = z.infer<typeof donorJobSchema>;
export type WhatsappJob = z.infer<typeof whatsappJobSchema>;
export type AdminAlertJob = z.infer<typeof adminAlertJobSchema>;
export type NotifyJob = z.infer<typeof notifyJobSchema>;

/**
 * Referensi dedup per event. payment.paid/expired & receipt.issued: satu per transaksi
 * (`event:trx:channel`, dipakai drain outbox §6a). payment.pending/failed bisa terjadi per
 * attempt (ganti metode, BR-17) → `event:trx:payment:channel`.
 */
export function dedupRef(job: NotifyJob): string {
  if (job.event === "whatsapp.send") return dedupRef(whatsappSource(job));
  if (job.event === "admin.alert") return `${job.kind}:${job.alert ?? "all"}:${job.ref ?? job.date ?? "-"}`;
  if (job.event === "payment.pending" || job.event === "payment.failed") {
    return `${job.transactionId}:${job.paymentId}`;
  }
  return job.transactionId;
}

/** Job donor asal dari job whatsapp.send (dedup_key WA = milik event asal). */
export const whatsappSource = (job: WhatsappJob): DonorJob => ({
  event: job.source,
  transactionId: job.transactionId,
  paymentId: job.paymentId,
});

export const dedupKey = (job: NotifyJob, channel: "email" | "whatsapp"): string =>
  job.event === "whatsapp.send"
    ? dedupKey(whatsappSource(job), "whatsapp")
    : `${job.event}:${dedupRef(job)}:${channel}`;

/** Dedup id QStash (tanpa ':' agar konsisten dengan id yang sudah dipakai, mis. payment-paid-{trx}). */
export function qstashDedupId(job: NotifyJob): string {
  if (job.event === "whatsapp.send") {
    return `wa-${job.source}-${dedupRef(job)}`.replace(/[^A-Za-z0-9_-]/g, "-");
  }
  if (job.event === "payment.paid") return `payment-paid-${job.transactionId}`;
  if (job.event === "payment.pending") return `payment-pending-${job.paymentId}`;
  if (job.event === "admin.alert" && job.kind === "reconciliation") return `reconcile-alert-${job.date}`;
  return `${job.event}-${dedupRef(job)}`.replace(/[^A-Za-z0-9_-]/g, "-");
}
