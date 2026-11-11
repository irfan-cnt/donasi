import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { CampaignDetailView } from "@/components/public/campaign-detail-view";
import { ImageValidationError, processImageUpload } from "@/lib/images/process-image";
import { sanitizeRichText } from "@/lib/sanitize";
import type { CampaignDetail } from "@/server/queries/public-campaign-detail";

// P25 (T-48): uji keamanan yang belum ada sebelumnya — upload berbahaya (HTML/SVG berganti
// ekstensi, polyglot, decompression bomb) dan XSS di nama donatur, doa, deskripsi & berita.

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

const XSS_NAME = '<script>alert("nama")</script>';
const XSS_PRAYER = '"><img src=x onerror=alert(1)><svg onload=alert(2)>';

describe("upload berbahaya ditolak / dinetralkan", () => {
  it("HTML berekstensi .jpg & SVG (berapa pun Content-Type-nya) → ditolak", async () => {
    const html = Buffer.from("<!doctype html><html><script>alert(1)</script></html>");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>');
    await expect(processImageUpload(html)).rejects.toBeInstanceOf(ImageValidationError);
    await expect(processImageUpload(svg)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("magic bytes PNG + isi HTML (header palsu) → ditolak", async () => {
    const fake = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("<html><script>alert(1)</script></html>"),
    ]);
    await expect(processImageUpload(fake)).rejects.toThrow(/rusak/);
  });

  it("polyglot (JPEG valid + payload HTML/JS di ekor) → di-encode ulang WebP tanpa payload", async () => {
    const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#123456" } }).jpeg().toBuffer();
    const payload = "<script>alert('polyglot')</script>";
    const out = await processImageUpload(Buffer.concat([jpeg, Buffer.from(payload)]));
    expect(out.contentType).toBe("image/webp");
    expect(out.data.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(out.data.includes(Buffer.from("<script"))).toBe(false);
  });

  it("decompression bomb (dimensi > 40 MP, berkas kecil) → ditolak", async () => {
    const bomb = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: "#ffffff" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(bomb.length).toBeLessThan(2 * 1024 * 1024);
    await expect(processImageUpload(bomb)).rejects.toThrow(/rusak/);
  }, 30_000);
});

function campaign(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: "c1",
    slug: "uji-xss",
    title: "Uji <b>XSS</b>",
    shortDescription: "<img src=x onerror=alert(3)>",
    descriptionHtml: sanitizeRichText('<p>Aman</p><script>alert(4)</script><img src=x onerror=alert(5)><a href="javascript:alert(6)">x</a>'),
    seoTitle: null,
    seoDescription: null,
    categoryName: "Pendidikan",
    categorySlug: "pendidikan",
    status: "published",
    images: [],
    targetAmount: 1_000_000n,
    collectedAmount: 50_000n,
    donorCount: 1,
    daysLeft: 10,
    publishedAt: new Date("2026-11-01T00:00:00Z"),
    updatedAt: new Date("2026-11-01T00:00:00Z"),
    disbursements: { items: [], total: 0n } as unknown as CampaignDetail["disbursements"],
    news: [],
    newsCount: 0,
    donations: [{ name: XSS_NAME, prayer: XSS_PRAYER, amount: 50_000n, timeLabel: "baru saja" }],
    ...overrides,
  };
}

describe("XSS di halaman campaign", () => {
  it("nama donatur & doa di-escape React (tidak menjadi elemen)", () => {
    const html = renderToStaticMarkup(createElement(CampaignDetailView, { c: campaign() }));
    expect(html).not.toContain("<script>alert");
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).not.toMatch(/<svg[^>]*onload/i);
    expect(html).toContain("&lt;script&gt;alert(&quot;nama&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("deskripsi (rich text) disanitasi: tanpa script/handler/javascript:", () => {
    const html = renderToStaticMarkup(createElement(CampaignDetailView, { c: campaign() }));
    expect(html).toContain("<p>Aman</p>");
    expect(html).not.toMatch(/alert\((4|5|6)\)/);
    expect(html).not.toMatch(/javascript:/i);
  });

  it("konten berita: payload umum dinetralkan sanitizer", () => {
    const payloads = [
      "<iframe src=//evil.test></iframe>",
      "<object data=x></object><embed src=x>",
      '<a href="  JaVaScRiPt:alert(1)">x</a>',
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
      "<form action=//evil.test><input name=p></form>",
      "<style>*{background:url(//evil.test)}</style>",
      '<p style="background:url(javascript:alert(1))">s</p>',
      "<math><mi xlink:href=javascript:alert(1)>x</mi></math>",
    ];
    for (const p of payloads) {
      const out = sanitizeRichText(p);
      expect(out, p).not.toMatch(/<(iframe|object|embed|form|input|style|math|script)\b/i);
      expect(out, p).not.toMatch(/javascript:|data:text\/html|style=/i);
    }
  });
});

describe("P25 OD-31: nama donatur di notifikasi tanpa URL/domain", async () => {
  const { neutraliseDonorName } = await import("@/server/services/notification-service");
  it.each([
    ["Ahmad Fauzi", "Ahmad Fauzi"],
    ["H. Abdullah", "H. Abdullah"],
    ["Klik https://evil.test/hadiah sekarang", "Klik sekarang"],
    ["menang di www.evil.test", "menang di"],
    ["hadiah evil-site.co.id/x", "hadiah"],
    ["bit.ly", "Hamba Allah"],
  ])("%s → %s", (input, expected) => {
    expect(neutraliseDonorName(input)).toBe(expected);
  });
});

describe("P25 I1: clientIp terpusat", async () => {
  const { clientIp } = await import("@/lib/http/client-ip");
  const h = (o: Record<string, string>) => new Headers(o);
  it("header platform Vercel diutamakan; XFF entri pertama; nilai bukan IP → null", () => {
    expect(clientIp(h({ "x-vercel-forwarded-for": "198.51.100.7", "x-forwarded-for": "1.2.3.4" }))).toBe("198.51.100.7");
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIp(h({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(h({ "x-forwarded-for": "bukan-ip" }))).toBeNull();
    expect(clientIp(h({}))).toBeNull();
  });
});
