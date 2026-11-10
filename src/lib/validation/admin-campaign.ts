import { z } from "zod";
import { MAX_SUGGESTIONS, PLATFORM_MAX_AMOUNT, PROVIDER_MIN_AMOUNT } from "@/lib/campaign-rules";

// Validasi input admin campaign, berita, dan penyaluran (P21; BR-01–BR-07, BR-43, AC-24.x).
// Nominal dikirim client sebagai string digit → bigint (tidak pernah JS number).

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Slug yang bentrok dengan rute/segmen aplikasi. */
export const RESERVED_SLUGS = new Set([
  "baru",
  "admin",
  "api",
  "pratinjau",
  "berita",
  "semua",
  "edit",
  "new",
  "campaign",
  "donasi",
  "transaksi",
  "akun",
  "masuk",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug minimal 3 karakter")
  .max(120, "Slug maksimal 120 karakter")
  .regex(SLUG_RE, "Slug hanya huruf kecil, angka, dan tanda hubung")
  .refine((s) => !RESERVED_SLUGS.has(s), "Slug ini dipakai sistem; pilih slug lain");

/** Judul → slug: huruf kecil, ASCII, tanda hubung. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export const moneySchema = z
  .union([z.string(), z.bigint()])
  .transform((v) => (typeof v === "bigint" ? v.toString() : v.replace(/[^\d]/g, "")))
  .pipe(z.string().regex(/^\d{1,13}$/, "Nominal tidak valid"))
  .transform((v) => BigInt(v))
  .refine((v) => v <= PLATFORM_MAX_AMOUNT, "Nominal melebihi batas platform Rp1.000.000.000");

const optionalMoney = z
  .union([z.string(), z.bigint(), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .pipe(z.union([z.null(), moneySchema]));

const nullableText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const isoDay = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const uuid = z.uuid();

/** Path gambar yang dikelola storage aplikasi (lihat lib/storage). Divalidasi ulang di service. */
const imageUrl = z.string().trim().min(1).max(500);

export const galleryItemSchema = z.object({
  url: imageUrl,
  alt: z.string().trim().min(1, "Teks alternatif gambar wajib diisi").max(200),
  width: z.number().int().positive().max(10_000).nullable().optional(),
  height: z.number().int().positive().max(10_000).nullable().optional(),
});

export const packageSchema = z.object({
  id: uuid.nullable().optional(),
  label: z.string().trim().min(1, "Label paket wajib diisi").max(80),
  amount: moneySchema.refine((v) => v >= PROVIDER_MIN_AMOUNT, "Nominal paket minimal Rp1.000"),
  description: nullableText(200, "Deskripsi paket maksimal 200 karakter"),
  isActive: z.boolean(),
});

export const campaignInputSchema = z
  .object({
    title: z.string().trim().min(10, "Judul minimal 10 karakter").max(120, "Judul maksimal 120 karakter"),
    slug: slugSchema,
    categoryId: uuid,
    shortDescription: z.string().trim().max(200, "Deskripsi singkat maksimal 200 karakter"),
    descriptionHtml: z.string().max(100_000, "Deskripsi terlalu panjang"),
    featuredImageUrl: imageUrl.nullable().optional().transform((v) => v ?? null),
    featuredImageAlt: nullableText(200, "Teks alternatif maksimal 200 karakter"),
    gallery: z.array(galleryItemSchema).max(12, "Galeri maksimal 12 gambar"),
    amountType: z.enum(["open", "fixed"]),
    minAmount: moneySchema.refine((v) => v >= PROVIDER_MIN_AMOUNT, "Minimum donasi minimal Rp1.000"),
    maxAmount: optionalMoney,
    suggestions: z.array(moneySchema).max(MAX_SUGGESTIONS, "Saran nominal maksimal 6"),
    packages: z.array(packageSchema).max(20, "Paket maksimal 20"),
    targetAmount: optionalMoney,
    startDate: isoDay,
    endDate: isoDay,
    isFeatured: z.boolean(),
    seoTitle: nullableText(70, "SEO title maksimal 70 karakter"),
    seoDescription: nullableText(160, "SEO description maksimal 160 karakter"),
  })
  .superRefine((v, ctx) => {
    // AC-24.3: gambar tanpa alt tidak bisa disimpan.
    if (v.featuredImageUrl && !v.featuredImageAlt) {
      ctx.addIssue({ code: "custom", path: ["featuredImageAlt"], message: "Teks alternatif gambar utama wajib diisi" });
    }
    if (v.maxAmount !== null && v.maxAmount < v.minAmount) {
      ctx.addIssue({ code: "custom", path: ["maxAmount"], message: "Maksimum harus ≥ minimum" });
    }
    if (v.targetAmount !== null && v.targetAmount <= 0n) {
      ctx.addIssue({ code: "custom", path: ["targetAmount"], message: "Target harus lebih dari 0" });
    }
    const max = v.maxAmount ?? PLATFORM_MAX_AMOUNT;
    const seen = new Set<string>();
    v.suggestions.forEach((s, i) => {
      if (s < v.minAmount || s > max) {
        ctx.addIssue({ code: "custom", path: ["suggestions", i], message: "Saran nominal harus di antara minimum dan maksimum" });
      }
      if (seen.has(String(s))) ctx.addIssue({ code: "custom", path: ["suggestions", i], message: "Saran nominal duplikat" });
      seen.add(String(s));
    });
    const pk = new Set<string>();
    v.packages.forEach((p, i) => {
      if (pk.has(String(p.amount))) {
        ctx.addIssue({ code: "custom", path: ["packages", i, "amount"], message: "Nominal paket tidak boleh sama" });
      }
      pk.add(String(p.amount));
    });
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Tanggal berakhir harus setelah tanggal mulai" });
    }
    if (v.amountType === "fixed" && v.packages.length === 0) {
      ctx.addIssue({ code: "custom", path: ["packages"], message: "Tambahkan minimal 1 paket" });
    }
  });

export type CampaignInput = z.output<typeof campaignInputSchema>;
export type CampaignFormValues = z.input<typeof campaignInputSchema>;

export const campaignStatusTarget = z.enum(["published", "paused", "completed", "archived"]);

export const newsInputSchema = z
  .object({
    campaignId: uuid,
    title: z.string().trim().min(5, "Judul minimal 5 karakter").max(150, "Judul maksimal 150 karakter"),
    slug: slugSchema,
    excerpt: nullableText(300, "Ringkasan maksimal 300 karakter"),
    contentHtml: z.string().max(100_000, "Konten terlalu panjang"),
    featuredImageUrl: imageUrl.nullable().optional().transform((v) => v ?? null),
    featuredImageAlt: nullableText(200, "Teks alternatif maksimal 200 karakter"),
    seoTitle: nullableText(70, "SEO title maksimal 70 karakter"),
    seoDescription: nullableText(160, "SEO description maksimal 160 karakter"),
  })
  .superRefine((v, ctx) => {
    if (v.featuredImageUrl && !v.featuredImageAlt) {
      ctx.addIssue({ code: "custom", path: ["featuredImageAlt"], message: "Teks alternatif gambar wajib diisi" });
    }
  });

export type NewsInput = z.output<typeof newsInputSchema>;
export type NewsFormValues = z.input<typeof newsInputSchema>;

export const disbursementInputSchema = z.object({
  campaignId: uuid,
  amount: moneySchema.refine((v) => v > 0n, "Nominal harus lebih dari 0"),
  kind: z.enum(["program", "operational", "bank_fee"]),
  description: z.string().trim().min(3, "Keterangan minimal 3 karakter").max(500, "Keterangan maksimal 500 karakter"),
  disbursedAt: z.iso.date("Tanggal tidak valid"),
  newsId: uuid.nullable().optional().transform((v) => v ?? null),
});

export type DisbursementInput = z.output<typeof disbursementInputSchema>;

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export const CAMPAIGN_PAGE_SIZE = 20;

export const adminCampaignListQuery = z.object({
  q: z.preprocess(one, z.string().trim().max(100).optional().catch(undefined)),
  status: z.preprocess(one, z.enum(["draft", "published", "paused", "completed", "archived"]).optional().catch(undefined)),
  kategori: z.preprocess(one, z.uuid().optional().catch(undefined)),
  tipe: z.preprocess(one, z.enum(["open", "fixed"]).optional().catch(undefined)),
  hal: z.preprocess(one, z.coerce.number().int().min(1).max(10_000).catch(1).default(1)),
});

export type AdminCampaignListQuery = z.output<typeof adminCampaignListQuery>;

export const adminNewsListQuery = z.object({
  q: z.preprocess(one, z.string().trim().max(100).optional().catch(undefined)),
  campaign: z.preprocess(one, z.uuid().optional().catch(undefined)),
  status: z.preprocess(one, z.enum(["draft", "published"]).optional().catch(undefined)),
  edit: z.preprocess(one, z.uuid().optional().catch(undefined)),
  tulis: z.preprocess(one, z.string().optional().catch(undefined)),
  hal: z.preprocess(one, z.coerce.number().int().min(1).max(10_000).catch(1).default(1)),
});

/** Tanggal kalender WIB → awal/akhir hari dalam UTC. */
export const wibStartOfDay = (iso: string) => new Date(`${iso}T00:00:00+07:00`);
export const wibEndOfDay = (iso: string) => new Date(`${iso}T23:59:59+07:00`);
