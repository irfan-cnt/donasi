import { z } from "zod";
import { instructionSectionsSchema } from "@/lib/payments/instruction-template";
import { moneySchema } from "./admin-campaign";

// Validasi input admin keuangan (P22; F-26–F-30). Query string halaman memakai `.catch()` agar
// nilai rusak diabaikan (bukan error), batas paginasi dikunci. Input mutasi ketat.

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const opt = <T extends z.ZodType>(s: T) => z.preprocess(one, s.optional().catch(undefined));
const isoDate = z
  .string()
  .regex(ISO_DATE)
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00+07:00`).getTime()));
const page = z.preprocess(one, z.coerce.number().int().min(1).max(10_000).catch(1).default(1));

export const FINANCE_PAGE_SIZE = 25;
/** Di atas batas ini ekspor diproses async via QStash (F-27). */
export const EXPORT_SYNC_LIMIT = 10_000;
/**
 * Batas keras satu berkas ekspor async. Job menyusun berkas di memori sebelum upload ke Blob
 * (upload stream/multipart belum diverifikasi di store proyek): 50.000 baris ≈ 10–15 MB per job,
 * aman untuk fungsi serverless. Ekspor lebih besar → persempit filter (mis. per bulan).
 */
export const EXPORT_MAX_ROWS = 50_000;

export const TRANSACTION_STATUSES = ["created", "pending", "paid", "expired", "failed", "cancelled", "refunded"] as const;

export const transactionFilterSchema = z.object({
  q: opt(z.string().trim().min(1).max(100)),
  status: opt(z.enum(TRANSACTION_STATUSES)),
  campaign: opt(z.uuid()),
  /** Kode metode pembayaran (payment_methods.code). */
  metode: opt(z.string().regex(/^[a-z0-9_]{1,40}$/)),
  dari: opt(isoDate),
  sampai: opt(isoDate),
});
export type TransactionFilter = z.output<typeof transactionFilterSchema>;
export const transactionListQuery = transactionFilterSchema.extend({ hal: page });
export type TransactionListQuery = z.output<typeof transactionListQuery>;

export const donorFilterSchema = z.object({
  q: opt(z.string().trim().min(1).max(100)),
  tipe: opt(z.enum(["akun", "tamu"])),
  urut: z.preprocess(one, z.enum(["total", "terakhir", "jumlah"]).catch("total").default("total")),
});
export type DonorFilter = z.output<typeof donorFilterSchema>;
export const donorListQuery = donorFilterSchema.extend({ hal: page, id: opt(z.uuid()) });
export type DonorListQuery = z.output<typeof donorListQuery>;

export const PAYMENT_EVENT_TYPES = ["notification", "create_request", "create_error", "status_check", "expire_request"] as const;
export const EVENT_RESULTS = ["received", "processed", "duplicate", "ignored_transition", "amount_mismatch", "unknown_payment", "error"] as const;

export const paymentEventQuery = z.object({
  /** Kode transaksi (TK-…), order id (UUID), atau ref provider. */
  q: opt(z.string().trim().min(1).max(100)),
  tipe: opt(z.enum(PAYMENT_EVENT_TYPES)),
  verifikasi: opt(z.enum(["pending", "verified", "rejected"])),
  hasil: opt(z.enum(EVENT_RESULTS)),
  hal: page,
  id: opt(z.uuid()),
});
export type PaymentEventQuery = z.output<typeof paymentEventQuery>;

export const auditQuery = z.object({
  /** UUID admin, atau aktor non-admin. */
  aktor: opt(z.union([z.uuid(), z.enum(["system", "provider", "donor"])])),
  aksi: opt(z.string().regex(/^[a-z_]{1,40}(\.[a-z_]{1,40}){1,3}$/)),
  entitas: opt(z.string().regex(/^[a-z_]{1,40}$/)),
  /** Id entitas persis (UUID/kode). */
  q: opt(z.string().trim().min(1).max(100)),
  hal: page,
});
export type AuditQuery = z.output<typeof auditQuery>;

/** Tanggal kalender WIB → rentang UTC [awal, akhir hari]. */
export const wibStart = (iso: string) => new Date(`${iso}T00:00:00+07:00`);
export const wibEnd = (iso: string) => new Date(`${iso}T23:59:59.999+07:00`);

// ---------- Ekspor ----------
export const exportRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("transactions"), filters: transactionFilterSchema }),
  z.object({ kind: z.literal("donors"), filters: donorFilterSchema }),
]);
export type ExportRequest = z.output<typeof exportRequestSchema>;

// ---------- Metode pembayaran ----------
export const EXPIRY_PRESETS = [15, 30, 60, 180, 360, 720, 1440, 2880, 4320] as const;

export const paymentMethodInputSchema = z
  .object({
    displayName: z.string().trim().min(2, "Nama tampil minimal 2 karakter").max(60, "Maksimal 60 karakter"),
    logoUrl: z.string().trim().max(500).nullable(),
    isActive: z.boolean(),
    minAmount: moneySchema,
    maxAmount: z.union([z.literal(""), moneySchema]).transform((v) => (v === "" ? null : v)),
    expiryMinutes: z.coerce.number().int().min(5, "Minimal 5 menit").max(4320, "Maksimal 3 hari (4.320 menit)"),
    /** OD-04: biaya ditanggung lembaga — hanya untuk pencatatan, donatur membayar nominal tepat. */
    feeFlat: z.union([z.literal(""), moneySchema]).transform((v) => (v === "" ? 0n : v)),
    feePercent: z
      .string()
      .trim()
      .regex(/^\d{1,2}(\.\d{1,2})?$/, "Format persen 0–99,99 (titik desimal)")
      .default("0"),
    instructions: instructionSectionsSchema,
  })
  .superRefine((v, ctx) => {
    if (v.minAmount < 1000n) ctx.addIssue({ code: "custom", path: ["minAmount"], message: "Minimal Rp1.000" });
    if (v.maxAmount !== null && v.maxAmount < v.minAmount) {
      ctx.addIssue({ code: "custom", path: ["maxAmount"], message: "Maksimal harus ≥ minimal" });
    }
  });
export type PaymentMethodInput = z.output<typeof paymentMethodInputSchema>;
export type PaymentMethodFormValues = z.input<typeof paymentMethodInputSchema>;

export const reorderSchema = z.array(z.uuid()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Duplikat");
