import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { canDeletePermanently, canTransition, publishBlockers, type PublishCheckInput } from "@/lib/campaign-rules";
import { detectImageType, ImageValidationError, MAX_IMAGE_BYTES, processImageUpload } from "@/lib/images/process-image";
import { campaignInputSchema, newsInputSchema, slugify } from "@/lib/validation/admin-campaign";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";

const ready: PublishCheckInput = {
  title: "Sedekah Air Bersih untuk Desa",
  slug: "sedekah-air-bersih",
  categoryId: "019a0000-0000-7000-8000-000000000001",
  shortDescription: "Bantu sumur warga",
  descriptionHtml: "<p>Isi</p>",
  featuredImageUrl: "/api/dev-uploads/x.webp",
  featuredImageAlt: "Sumur",
  amountType: "open",
  minAmount: 10_000n,
  maxAmount: null,
  suggestions: [25_000n],
  packages: [],
};

describe("aturan status campaign (BR-01)", () => {
  it("draft hanya ke published/arsip; archived final", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("draft", "paused")).toBe(false);
    expect(canTransition("published", "paused")).toBe(true);
    expect(canTransition("paused", "published")).toBe(true);
    expect(canTransition("completed", "published")).toBe(false);
    expect(canTransition("archived", "published")).toBe(false);
    expect(canTransition("archived", "draft" as never)).toBe(false);
  });

  it("hapus permanen hanya draft tanpa transaksi (AC-24.1)", () => {
    expect(canDeletePermanently("draft", 0)).toBe(true);
    expect(canDeletePermanently("draft", 1)).toBe(false);
    expect(canDeletePermanently("published", 0)).toBe(false);
  });
});

describe("validasi publish (BR-02)", () => {
  it("lengkap → boleh terbit", () => expect(publishBlockers(ready)).toEqual([]));
  it("tanpa gambar utama / alt / deskripsi → ditolak", () => {
    expect(publishBlockers({ ...ready, featuredImageUrl: null }).join()).toMatch(/Gambar utama/);
    expect(publishBlockers({ ...ready, featuredImageAlt: " " }).join()).toMatch(/alternatif/);
    expect(publishBlockers({ ...ready, descriptionHtml: "<p> </p>" }).join()).toMatch(/Deskripsi lengkap/);
    expect(publishBlockers({ ...ready, shortDescription: "" }).join()).toMatch(/singkat/);
  });
  it("fixed tanpa paket aktif → ditolak (BR-07)", () => {
    const fixed = { ...ready, amountType: "fixed" as const };
    expect(publishBlockers({ ...fixed, packages: [{ amount: 50_000n, isActive: false }] }).join()).toMatch(/paket aktif/);
    expect(publishBlockers({ ...fixed, packages: [{ amount: 50_000n, isActive: true }] })).toEqual([]);
  });
  it("saran di luar rentang min/max → ditolak (BR-06)", () => {
    expect(publishBlockers({ ...ready, suggestions: [5_000n] }).join()).toMatch(/Saran/);
  });
});

const baseInput = {
  title: "Sedekah Air Bersih untuk Desa",
  slug: "sedekah-air-bersih",
  categoryId: "019a0000-0000-7000-8000-000000000001",
  shortDescription: "x",
  descriptionHtml: "<p>x</p>",
  featuredImageUrl: null,
  featuredImageAlt: null,
  gallery: [],
  amountType: "open",
  minAmount: "10000",
  maxAmount: "",
  suggestions: ["25000"],
  packages: [],
  targetAmount: null,
  startDate: "",
  endDate: "",
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
};

describe("skema input campaign", () => {
  it("nominal → bigint, kosong → null", () => {
    const r = campaignInputSchema.parse({ ...baseInput, minAmount: "Rp10.000", targetAmount: "125000000" });
    expect(r.minAmount).toBe(10_000n);
    expect(r.targetAmount).toBe(125_000_000n);
    expect(r.maxAmount).toBeNull();
  });
  it("slug reserved / format salah ditolak", () => {
    expect(campaignInputSchema.safeParse({ ...baseInput, slug: "baru" }).success).toBe(false);
    expect(campaignInputSchema.safeParse({ ...baseInput, slug: "Ada Spasi" }).success).toBe(false);
  });
  it("gambar tanpa alt tidak bisa disimpan (AC-24.3)", () => {
    const r = campaignInputSchema.safeParse({ ...baseInput, featuredImageUrl: "/api/dev-uploads/a.webp" });
    expect(r.success).toBe(false);
    const g = campaignInputSchema.safeParse({ ...baseInput, gallery: [{ url: "/api/dev-uploads/a.webp", alt: "" }] });
    expect(g.success).toBe(false);
  });
  it("saran > 6, paket duplikat, nominal > batas platform ditolak", () => {
    const s = ["10000", "20000", "30000", "40000", "50000", "60000", "70000"];
    expect(campaignInputSchema.safeParse({ ...baseInput, suggestions: s }).success).toBe(false);
    const pk = { label: "A", amount: "50000", isActive: true };
    expect(campaignInputSchema.safeParse({ ...baseInput, amountType: "fixed", packages: [pk, pk] }).success).toBe(false);
    expect(campaignInputSchema.safeParse({ ...baseInput, minAmount: "2000000000" }).success).toBe(false);
  });
  it("berita: gambar wajib alt; slugify", () => {
    expect(
      newsInputSchema.safeParse({ campaignId: baseInput.categoryId, title: "Kabar baik", slug: "kabar-baik", contentHtml: "x", featuredImageUrl: "/api/dev-uploads/a.webp" }).success,
    ).toBe(false);
    expect(slugify("Distribusi Paket — Gelombang 1 di Bogor!")).toBe("distribusi-paket-gelombang-1-di-bogor");
  });
});

describe("matriks role (BR-40) untuk aksi P21", () => {
  const perms = (role: keyof typeof ROLE_PERMISSIONS) => ROLE_PERMISSIONS[role];
  it("editor: tulis campaign & berita, tidak bisa publish campaign / penyaluran", () => {
    expect(hasPermission(perms("editor"), "campaigns.write")).toBe(true);
    expect(hasPermission(perms("editor"), "campaigns.publish")).toBe(false);
    expect(hasPermission(perms("editor"), "news.publish")).toBe(true);
    expect(hasPermission(perms("editor"), "disbursements.write")).toBe(false);
  });
  it("finance: baca campaign + penyaluran, tidak menulis campaign", () => {
    expect(hasPermission(perms("finance"), "campaigns.read")).toBe(true);
    expect(hasPermission(perms("finance"), "campaigns.write")).toBe(false);
    expect(hasPermission(perms("finance"), "disbursements.write")).toBe(true);
  });
});

describe("upload gambar: magic bytes, ukuran, WebP", () => {
  it("deteksi dari magic bytes, bukan ekstensi", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectImageType(Buffer.from("<?php echo 1; ?> fake.jpg"))).toBeNull();
    expect(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });
  it("menolak file palsu (teks berekstensi .jpg) dan > 2 MB", async () => {
    await expect(processImageUpload(Buffer.from("bukan gambar sama sekali"))).rejects.toBeInstanceOf(ImageValidationError);
    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1, 0);
    big.set([0xff, 0xd8, 0xff], 0);
    await expect(processImageUpload(big)).rejects.toThrow(/2 MB/);
  });
  it("header JPEG dengan isi rusak → ditolak", async () => {
    await expect(processImageUpload(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]))).rejects.toThrow(/rusak/);
  });
  it("PNG valid → WebP, lebar dibatasi 1600", async () => {
    const png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#0a7" } }).png().toBuffer();
    const out = await processImageUpload(png);
    expect(out.contentType).toBe("image/webp");
    expect(detectImageType(out.data)).toBe("webp");
    expect(out.width).toBe(1600);
    expect(out.height).toBe(800);
  });
});
