import "server-only";
import type { EmailQuotaCounter, EmailSender } from "@/lib/email/gmail";
import type { Logger } from "@/lib/logger";
import { formatRupiah } from "@/lib/money";
import { renderEmailLayout, type EmailOrganization } from "@/lib/notifications/email-layout";
import {
  dedupKey,
  notifyJobSchema,
  type AdminAlertJob,
  type DonorJob,
  type NotifyJob,
} from "@/lib/notifications/jobs";
import {
  redactPayload,
  renderSubject,
  renderTemplate,
  type TemplateVars,
} from "@/lib/notifications/template";
import { renderInstructionSections } from "@/lib/payments/instruction-template";
import { SITE_NAME } from "@/lib/site";
import {
  claimNotificationLog,
  findActiveTemplate,
  findNotificationContext,
  findOrganizationSettings,
  updateNotificationLog,
  type NotificationContext,
} from "@/server/repositories/notification-repository";

// Handler notifikasi (T-28/T-29/T-31, F-19, BR-30–BR-32). Alur: job → konteks DB → template aktif
// per kanal → consent → kirim → notification_logs (satu baris per kanal yang diharapkan, termasuk
// `skipped`, dedup_key event:ref:channel). Kegagalan TIDAK PERNAH mengubah status pembayaran
// (BR-31): modul ini tidak menulis payments/transactions. SMTP gagal → baris `failed` + error
// dilempar → 500 → QStash retry (3×).

export interface NotifyConfig {
  /** NOTIFICATIONS_ENABLED. false → semua kanal dicatat `skipped`. */
  enabled: boolean;
  /** WHATSAPP_ENABLED (kanal sendiri dibuat P17). */
  whatsappEnabled: boolean;
  adminEmail: string | null;
  dailyLimit: number;
  siteUrl: string;
}

export interface NotifyDeps {
  log: Logger;
  sender: EmailSender;
  quota: EmailQuotaCounter;
  config: NotifyConfig;
  /** Alert kuota > 80% (dikirim lewat job admin.alert terpisah). */
  publishAdminAlert: (job: AdminAlertJob, log: Logger) => Promise<void>;
  now?: () => Date;
}

export type ChannelOutcome = "sent" | "failed" | "skipped" | "duplicate";

export interface NotifySummary {
  event: string;
  email?: ChannelOutcome;
  whatsapp?: ChannelOutcome;
  ignored?: string;
}

/** Error SMTP/transport: nama + kode saja (tanpa pesan mentah yang bisa memuat alamat/kredensial). */
export function safeErrorCode(e: unknown): string {
  const name = e instanceof Error ? e.name : "unknown";
  const rec = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
  const code = typeof rec.code === "string" ? `:${rec.code}` : "";
  const smtp = typeof rec.responseCode === "number" ? `:${rec.responseCode}` : "";
  return `${name}${code}${smtp}`.slice(0, 120);
}

const STATUS_LABEL: Record<string, string> = {
  created: "Dibuat",
  pending: "Menunggu pembayaran",
  paid: "Berhasil",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
};

const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  dateStyle: "long",
  timeStyle: "short",
});
export const formatJakarta = (d: Date) => `${dateTime.format(d)} WIB`;

export function jakartaDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Instruksi bayar sebagai teks (nomor VA / kode bayar / batas waktu + langkah metode). */
export function paymentInstructionText(
  payment: NotificationContext["payment"],
  amount: bigint,
): string {
  if (!payment) return "";
  const i = (payment.instruction && typeof payment.instruction === "object"
    ? payment.instruction
    : {}) as Record<string, unknown>;
  const lines: string[] = [];
  const bank = str(i.bankName);
  const va = str(i.vaNumber);
  const billKey = str(i.billKey) ?? str(i.paymentCode);
  const biller = str(i.billerCode);
  if (va) lines.push(`${bank ? `Bank ${bank.toUpperCase()} — ` : ""}Nomor Virtual Account: ${va}`);
  if (biller) lines.push(`Kode perusahaan: ${biller}`);
  if (billKey) lines.push(`Kode bayar: ${billKey}`);
  if (i.kind === "qr") lines.push("Pindai kode QR yang tampil di halaman pembayaran.");
  if (i.kind === "redirect") lines.push("Selesaikan pembayaran di aplikasi e-wallet Anda.");
  lines.push(`Nominal: ${formatRupiah(amount)}`);
  if (payment.expiresAt) lines.push(`Bayar sebelum: ${formatJakarta(payment.expiresAt)}`);
  const steps = renderInstructionSections(payment.methodInstructions, {
    va_number: va ?? billKey ?? undefined,
    bank_name: bank ?? undefined,
    amount: formatRupiah(amount),
  });
  for (const s of steps) {
    lines.push("", s.title);
    s.steps.forEach((step, n) => lines.push(`${n + 1}. ${step}`));
  }
  return lines.join("\n");
}

/**
 * Variabel whitelist dari konteks. payment_url = halaman status transaksi TANPA access token
 * (token hanya tersimpan sebagai hash; payment-architecture.md §3c) — donatur yang membuka dari
 * perangkat checkout tetap melihat detail lewat sesi/tautan aslinya.
 */
export function buildVars(ctx: NotificationContext, siteUrl: string): TemplateVars {
  return {
    donor_name: ctx.donorName,
    donor_email: ctx.donorEmail,
    donor_phone: ctx.donorPhone ?? "",
    campaign_title: ctx.campaignTitle,
    transaction_id: ctx.code,
    donation_amount: formatRupiah(ctx.amount),
    payment_method: ctx.payment?.methodName ?? "",
    payment_status: STATUS_LABEL[ctx.payment?.status ?? ctx.transactionStatus] ?? "",
    payment_url: `${siteUrl}/transaksi/${ctx.code}/menunggu`,
    payment_instruction: paymentInstructionText(ctx.payment, ctx.amount),
    created_at: formatJakarta(ctx.createdAt),
  };
}

async function organization(siteUrl: string): Promise<EmailOrganization> {
  const s = await findOrganizationSettings();
  return { name: s.name ?? SITE_NAME, address: s.address ?? "", siteUrl };
}

/** Kuota harian: false = melewati limit. Alert sekali per hari bila > 80%. */
async function reserveQuota(deps: NotifyDeps, now: Date): Promise<boolean> {
  const day = jakartaDay(now);
  const count = await deps.quota.increment(day);
  const limit = deps.config.dailyLimit;
  if (count > limit * 0.8 && (await deps.quota.once(`email-quota-${day}`))) {
    deps.log.error("email.quota_warning", { count, limit });
    await deps
      .publishAdminAlert(
        { event: "admin.alert", kind: "email_quota", date: day, counts: { sentToday: count, dailyLimit: limit } },
        deps.log,
      )
      .catch((e: unknown) => deps.log.error("publish alert kuota gagal", { error: safeErrorCode(e) }));
  }
  return count <= limit;
}

interface EmailPlan {
  event: string;
  dedupKey: string;
  transactionId: string | null;
  recipient: string;
  template: { id: string; version: number } | null;
  payload: Record<string, unknown> | null;
  /** null = lewati dengan alasan `skipReason`. */
  build: (() => Promise<{ subject: string; html: string; text: string }>) | null;
  skipReason?: string;
}

/** Klaim log → (lewati | kirim) → perbarui log. Melempar bila SMTP gagal (agar QStash retry). */
async function deliverEmail(plan: EmailPlan, deps: NotifyDeps, now: Date): Promise<ChannelOutcome> {
  const skipReason = !deps.config.enabled
    ? "NOTIFICATIONS_ENABLED=false"
    : !plan.recipient
      ? "penerima kosong"
      : (plan.skipReason ?? (plan.build ? null : "template tidak aktif"));
  const claimed = await claimNotificationLog({
    channel: "email",
    recipient: plan.recipient || "-",
    event: plan.event,
    dedupKey: plan.dedupKey,
    transactionId: plan.transactionId,
    templateId: plan.template?.id ?? null,
    templateVersion: plan.template?.version ?? null,
    requestPayload: plan.payload,
    status: skipReason ? "skipped" : "queued",
    errorMessage: skipReason,
  });
  if (!claimed.created && (claimed.status === "sent" || claimed.status === "skipped")) {
    return "duplicate";
  }
  if (skipReason) {
    if (!claimed.created) await updateNotificationLog(claimed.id, { status: "skipped", errorMessage: skipReason });
    return "skipped";
  }
  const attempt = claimed.attempt + 1;
  if (!(await reserveQuota(deps, now))) {
    await updateNotificationLog(claimed.id, {
      status: "failed",
      attempt,
      errorMessage: "kuota email harian terlampaui (EMAIL_DAILY_LIMIT)",
    });
    deps.log.error("email: kuota harian terlampaui; tidak dikirim", { event: plan.event });
    return "failed"; // retry hari yang sama tidak membantu; admin bisa kirim ulang (P23)
  }
  try {
    const message = await plan.build!();
    const res = await deps.sender.send({ to: plan.recipient, ...message });
    await updateNotificationLog(claimed.id, {
      status: "sent",
      attempt,
      sent: true,
      errorMessage: null,
      providerResponse: { ...res },
    });
    return "sent";
  } catch (e) {
    const code = safeErrorCode(e);
    await updateNotificationLog(claimed.id, { status: "failed", attempt, errorMessage: code });
    deps.log.error("email: kirim gagal", { event: plan.event, attempt, error: code });
    throw new NotificationDeliveryError(code);
  }
}

export class NotificationDeliveryError extends Error {
  constructor(public readonly code: string) {
    super("notification delivery failed");
    this.name = "NotificationDeliveryError";
  }
}

/** Kanal WhatsApp (Fonnte) dibuat di P17: tulis `skipped` agar drain outbox §6a menganggapnya tertangani. */
async function recordWhatsapp(job: DonorJob, ctx: NotificationContext, deps: NotifyDeps, stale: string | null) {
  if (!ctx.whatsappOptIn) return undefined;
  const reason =
    stale ??
    (!ctx.donorPhone
      ? "nomor WhatsApp kosong"
      : !deps.config.enabled
        ? "NOTIFICATIONS_ENABLED=false"
        : deps.config.whatsappEnabled
          ? "kanal WhatsApp belum diimplementasikan (P17)"
          : "WHATSAPP_ENABLED=false");
  const claimed = await claimNotificationLog({
    channel: "whatsapp",
    recipient: ctx.donorPhone ?? "-",
    event: job.event,
    dedupKey: dedupKey(job, "whatsapp"),
    transactionId: job.transactionId,
    templateId: null,
    templateVersion: null,
    requestPayload: null,
    status: "skipped",
    errorMessage: reason,
  });
  return claimed.created ? ("skipped" as const) : ("duplicate" as const);
}

async function handleDonorJob(job: DonorJob, deps: NotifyDeps, now: Date): Promise<NotifySummary> {
  const ctx = await findNotificationContext(job.transactionId, job.paymentId);
  if (!ctx || !ctx.payment) {
    deps.log.warn("notify: transaksi/payment tidak ditemukan; diabaikan", { event: job.event });
    return { event: job.event, ignored: "not_found" };
  }
  // Event usang (mis. payment.pending tetapi payment sudah dibayar) → skipped, bukan kirim.
  const stale =
    job.event === "payment.pending" && ctx.payment.status !== "pending"
      ? `status payment sudah ${ctx.payment.status}`
      : null;
  const vars = buildVars(ctx, deps.config.siteUrl);
  const template = await findActiveTemplate(job.event, "email");
  let deliveryError: unknown = null;
  let email: ChannelOutcome | undefined;
  try {
    email = await deliverEmail(
      {
        event: job.event,
        dedupKey: dedupKey(job, "email"),
        transactionId: job.transactionId,
        recipient: ctx.donorEmail,
        template: template ? { id: template.id, version: template.version } : null,
        payload: redactPayload(vars),
        skipReason: stale ?? undefined,
        build: template
          ? async () => {
              const subject = renderSubject(template.subject ?? "", vars);
              const body = renderTemplate(template.body, vars);
              return { subject, ...renderEmailLayout({ subject, body, org: await organization(deps.config.siteUrl) }) };
            }
          : null,
      },
      deps,
      now,
    );
  } catch (e) {
    deliveryError = e;
    email = "failed";
  }
  // WA dicatat walau email gagal, agar retry tidak menunda kanal lain.
  const whatsapp = await recordWhatsapp(job, ctx, deps, stale);
  if (deliveryError) throw deliveryError;
  return { event: job.event, email, whatsapp };
}

const ALERT_LABEL: Record<string, string> = {
  amount_mismatch: "Nominal pembayaran tidak sesuai",
  paid_after_terminal: "Pembayaran masuk setelah transaksi selesai/kedaluwarsa",
  unknown_payment: "Notifikasi untuk pembayaran yang tidak dikenal",
  refund_reported: "Provider melaporkan refund",
  needs_review: "Pembayaran perlu ditinjau manual",
  provider_auth: "Server key Midtrans ditolak (401/403)",
  webhook_unverifiable: "Webhook Midtrans tidak dapat diverifikasi",
  provider_404_storm: "Banyak pembayaran tidak dikenal Midtrans (404) di job expiry",
};

export function renderAdminAlert(job: AdminAlertJob): { subject: string; body: string } {
  const lines: string[] = [];
  let title: string;
  if (job.kind === "reconciliation") {
    title = `Rekonsiliasi ${job.date ?? ""}: ada temuan`;
    lines.push("Job rekonsiliasi harian menemukan selisih/temuan berikut:");
  } else if (job.kind === "email_quota") {
    title = "Kuota email harian hampir habis";
    lines.push("Jumlah email hari ini sudah melewati 80% batas EMAIL_DAILY_LIMIT.");
  } else {
    title = ALERT_LABEL[job.alert ?? ""] ?? `Alert pembayaran: ${job.alert ?? "-"}`;
    lines.push(`Jenis: ${job.alert ?? "-"}`);
    if (job.paymentId) lines.push(`Payment ID: ${job.paymentId}`);
    if (job.transactionId) lines.push(`Transaction ID: ${job.transactionId}`);
  }
  for (const [k, v] of Object.entries(job.counts ?? {})) lines.push(`- ${k}: ${v}`);
  lines.push("", "Rincian ada di audit log admin (audit_logs) dan log server. Email ini otomatis.");
  return { subject: `[${SITE_NAME}] ${title}`, body: lines.join("\n") };
}

async function handleAdminAlert(job: AdminAlertJob, deps: NotifyDeps, now: Date): Promise<NotifySummary> {
  const rendered = renderAdminAlert(job);
  const email = await deliverEmail(
    {
      event: job.event,
      dedupKey: dedupKey(job, "email"),
      transactionId: job.transactionId ?? null,
      recipient: deps.config.adminEmail ?? "",
      template: null,
      payload: { kind: job.kind, alert: job.alert ?? null, ref: job.ref ?? job.date ?? null },
      skipReason: deps.config.adminEmail ? undefined : "EMAIL_ADMIN_ALERT kosong",
      build: async () => {
        const subject = renderSubject(rendered.subject, {});
        return {
          subject,
          ...renderEmailLayout({
            subject,
            body: rendered.body,
            org: await organization(deps.config.siteUrl),
            footerNote: "Alert internal untuk admin. Jangan diteruskan ke pihak luar.",
          }),
        };
      },
    },
    deps,
    now,
  );
  return { event: job.event, email };
}

/** Proses satu job notify. Body tidak valid → diabaikan (200, tidak di-retry). */
export async function processNotifyJob(body: unknown, deps: NotifyDeps): Promise<NotifySummary> {
  const parsed = notifyJobSchema.safeParse(body);
  if (!parsed.success) {
    deps.log.warn("notify: body tidak valid; diabaikan");
    return { event: "unknown", ignored: "invalid_body" };
  }
  const job: NotifyJob = parsed.data;
  const now = (deps.now ?? (() => new Date()))();
  if (job.event === "receipt.issued") {
    // Hook P19 (kuitansi PDF): template sudah di-seed; pengiriman disambungkan saat PDF tersedia.
    deps.log.info("notify: receipt.issued belum diaktifkan (P19)");
    return { event: job.event, ignored: "not_implemented" };
  }
  if (job.event === "admin.alert") return handleAdminAlert(job, deps, now);
  return handleDonorJob(job, deps, now);
}
