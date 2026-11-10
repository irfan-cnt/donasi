import { z } from "zod";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";
import { normalizeIndonesianPhone } from "@/lib/validation/donation";

/** Filter status riwayat donasi (F-13). `pending` mencakup `created` + `pending`. */
export const DONOR_STATUS_FILTERS = ["paid", "pending", "expired", "failed", "cancelled", "refunded"] as const;
export type DonorStatusFilter = (typeof DONOR_STATUS_FILTERS)[number];

export const DONOR_PAGE_SIZE = 20;

export interface DonorTrxCursor {
  createdAt: Date;
  id: string;
}

/** Cursor keyset opak: base64url(JSON {c: ISO, i: uuid}). Rusak → null (halaman pertama). */
export function encodeDonorCursor(c: DonorTrxCursor): string {
  return Buffer.from(JSON.stringify({ c: c.createdAt.toISOString(), i: c.id })).toString("base64url");
}

const cursorJson = z.object({ c: z.iso.datetime(), i: z.uuid() });

export function decodeDonorCursor(raw: string | undefined): DonorTrxCursor | null {
  if (!raw || raw.length > 200 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const parsed = cursorJson.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? { createdAt: new Date(parsed.data.c), id: parsed.data.i } : null;
  } catch {
    return null;
  }
}

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/** Query /akun/donasi: nilai tidak valid diabaikan (bukan error). */
export const donorListQuery = z.object({
  status: z.preprocess(one, z.enum(DONOR_STATUS_FILTERS).optional().catch(undefined)),
  tahun: z.preprocess(
    one,
    z.coerce.number().int().min(2020).max(2100).optional().catch(undefined),
  ),
  setelah: z.preprocess(one, z.string().optional().catch(undefined)),
  sebelum: z.preprocess(one, z.string().optional().catch(undefined)),
});

export const donorTrxCode = z.string().regex(TRANSACTION_CODE_PATTERN);

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.null()])
  .optional()
  .transform((v) => v === "on" || v === "true");

/** Form profil donatur (F-15, AC-15.1). Email TIDAK diterima dari form (read-only, dari Google). */
export const donorProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80, "Nama maksimal 80 karakter."),
    phone: z.string().trim().max(20, "Nomor WhatsApp tidak valid.").optional().default(""),
    whatsappOptIn: checkbox,
    defaultAnonymous: checkbox,
  })
  .transform((v, ctx) => {
    const phoneE164 = v.phone ? normalizeIndonesianPhone(v.phone) : null;
    if (v.phone && !phoneE164) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Nomor WhatsApp tidak valid. Gunakan format 08xx atau +62." });
      return z.NEVER;
    }
    if (v.whatsappOptIn && !phoneE164) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Isi nomor WhatsApp untuk mengaktifkan notifikasi WhatsApp." });
      return z.NEVER;
    }
    return { name: v.name, phoneE164, whatsappOptIn: v.whatsappOptIn, defaultAnonymous: v.defaultAnonymous };
  });

export type DonorProfileInput = z.output<typeof donorProfileSchema>;
export type DonorProfileFieldErrors = Partial<Record<"name" | "phone" | "form", string>>;

/** Konfirmasi hapus akun: wajib mengetik HAPUS. */
export const accountDeletionSchema = z.object({
  confirm: z.string().trim().refine((v) => v.toUpperCase() === "HAPUS", "Ketik HAPUS untuk konfirmasi."),
});
