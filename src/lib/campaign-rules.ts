// Aturan status & kelayakan terbit campaign (BR-01, BR-02, BR-06, BR-07). Modul murni: dipakai
// service admin (P21) dan unit test.

export type CampaignStatusCode = "draft" | "published" | "paused" | "completed" | "archived";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatusCode, string> = {
  draft: "Draf",
  published: "Tayang",
  paused: "Dijeda",
  completed: "Selesai",
  archived: "Diarsipkan",
};

/**
 * BR-01: draft → published ⇄ paused → completed → archived; archived final.
 * Arsip juga boleh dari draft/published/paused (P21 #3: campaign yang tidak bisa dihapus
 * permanen diarsipkan).
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatusCode, readonly CampaignStatusCode[]> = {
  draft: ["published", "archived"],
  published: ["paused", "completed", "archived"],
  paused: ["published", "completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export function canTransition(from: CampaignStatusCode, to: CampaignStatusCode): boolean {
  return CAMPAIGN_TRANSITIONS[from].includes(to);
}

/** Nominal maksimum absolut platform per transaksi (BR-08). */
export const PLATFORM_MAX_AMOUNT = 1_000_000_000n;
export const PROVIDER_MIN_AMOUNT = 1_000n;
export const MAX_SUGGESTIONS = 6;

export interface PublishCheckInput {
  title: string;
  slug: string;
  categoryId: string | null;
  shortDescription: string;
  descriptionHtml: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  amountType: "open" | "fixed";
  minAmount: bigint;
  maxAmount: bigint | null;
  suggestions: bigint[];
  packages: { amount: bigint; isActive: boolean }[];
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();

/** BR-02: daftar alasan campaign belum boleh terbit (kosong = boleh). */
export function publishBlockers(c: PublishCheckInput): string[] {
  const out: string[] = [];
  const titleLen = c.title.trim().length;
  if (titleLen < 10 || titleLen > 120) out.push("Judul wajib 10–120 karakter.");
  if (!c.slug) out.push("Slug wajib diisi.");
  if (!c.categoryId) out.push("Kategori wajib dipilih.");
  if (!c.shortDescription.trim()) out.push("Deskripsi singkat wajib diisi.");
  if (!textOf(c.descriptionHtml)) out.push("Deskripsi lengkap wajib diisi.");
  if (!c.featuredImageUrl) out.push("Gambar utama wajib diunggah.");
  else if (!c.featuredImageAlt?.trim()) out.push("Teks alternatif gambar utama wajib diisi.");
  if (c.amountType === "open") {
    if (c.minAmount < PROVIDER_MIN_AMOUNT) out.push("Minimum donasi minimal Rp1.000.");
    const max = c.maxAmount ?? PLATFORM_MAX_AMOUNT;
    if (max < c.minAmount) out.push("Maksimum donasi harus ≥ minimum.");
    if (max > PLATFORM_MAX_AMOUNT) out.push("Maksimum donasi melebihi batas platform Rp1.000.000.000.");
    if (c.suggestions.length > MAX_SUGGESTIONS) out.push("Saran nominal maksimal 6.");
    if (c.suggestions.some((s) => s < c.minAmount || s > max)) {
      out.push("Saran nominal harus di antara minimum dan maksimum.");
    }
  } else if (!c.packages.some((p) => p.isActive)) {
    out.push("Fixed amount wajib punya minimal 1 paket aktif.");
  }
  return out;
}

/** P21 #3 / AC-24.1: hapus permanen hanya draft tanpa transaksi. */
export function canDeletePermanently(status: CampaignStatusCode, transactionCount: number): boolean {
  return status === "draft" && transactionCount === 0;
}
