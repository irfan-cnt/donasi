import { z } from "zod";
import { MAX_BODY, MAX_SUBJECT } from "@/lib/notifications/template";

// Validasi input admin notifikasi (P23; F-20, F-21). Query string memakai `.catch()` (nilai rusak
// diabaikan), paginasi dikunci. Whitelist variabel dicek di service lewat validateTemplate.

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const opt = <T extends z.ZodType>(s: T) => z.preprocess(one, s.optional().catch(undefined));
const page = z.preprocess(one, z.coerce.number().int().min(1).max(10_000).catch(1).default(1));

export const NOTIFICATION_PAGE_SIZE = 25;
export const NOTIFICATION_CHANNELS = ["email", "whatsapp"] as const;
export const NOTIFICATION_STATUSES = ["queued", "sent", "failed", "skipped"] as const;

export const templatePageQuery = z.object({
  kanal: z.preprocess(one, z.enum(NOTIFICATION_CHANNELS).catch("email").default("email")),
  id: opt(z.uuid()),
});

export const notificationLogQuery = z.object({
  /** Kode transaksi (TK-…) atau penerima (email/nomor). */
  q: opt(z.string().trim().min(1).max(100)),
  kanal: opt(z.enum(NOTIFICATION_CHANNELS)),
  status: opt(z.enum(NOTIFICATION_STATUSES)),
  template: opt(z.uuid()),
  hal: page,
  id: opt(z.uuid()),
});
export type NotificationLogQuery = z.output<typeof notificationLogQuery>;

export const templateInputSchema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(100, "Nama maksimal 100 karakter"),
  subject: z.string().max(MAX_SUBJECT, `Subjek maksimal ${MAX_SUBJECT} karakter`).nullable(),
  body: z.string().max(MAX_BODY, `Isi maksimal ${MAX_BODY} karakter`),
  /** Versi yang sedang diedit (optimistic concurrency): simpan ditolak bila sudah berubah. */
  version: z.number().int().min(1),
});
export type TemplateInput = z.output<typeof templateInputSchema>;

export const resendInputSchema = z
  .object({
    logId: z.uuid(),
    force: z.boolean().default(false),
    reason: z.string().trim().max(500, "Alasan maksimal 500 karakter").default(""),
  })
  .refine((v) => !v.force || v.reason.length >= 10, {
    path: ["reason"],
    message: "Alasan kirim ulang paksa wajib diisi (minimal 10 karakter)",
  });
