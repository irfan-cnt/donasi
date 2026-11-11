import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroView, TrustStripView } from "@/components/public/landing-sections";
import { ANALYTICS_EVENTS, sanitizeAnalyticsUrl, sanitizeProps, track } from "@/lib/analytics";
import { faqJsonLd, serializeJsonLd } from "@/lib/json-ld";
import {
  LEGALITY_BLOCK,
  OPERATIONAL_FEE_SENTENCE,
  showPlatformStats,
  STATS_MIN_PAID_DONATIONS,
} from "@/lib/landing";
import { LANDING_FAQ, visibleFaq } from "@/lib/landing-faq";
import {
  LEGAL_DRAFT_NOTICE,
  LEGAL_FINAL,
  LEGAL_PAGES,
  legalRobots,
  legalSlots,
} from "@/lib/legal/content";
import { toOrganizationContact } from "@/server/queries/public-organization";

// P30 (landing page, marketing/landing-page-implementation-brief.md §5) + T-49 (halaman legal).

const PAGE_SRC =
  readFileSync("src/app/(public)/page.tsx", "utf8") +
  readFileSync("src/components/public/landing-sections.tsx", "utf8");
const FOOTER_SRC = readFileSync("src/components/public/footer.tsx", "utf8");
const OG_SRC = readFileSync("src/app/(public)/opengraph-image.tsx", "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("landing page — konten", () => {
  it("LP-AC-04: tidak ada nominal/statistik tetap di source landing", () => {
    expect(PAGE_SRC).not.toMatch(/Rp\s?\d/);
    expect(PAGE_SRC).not.toMatch(/\b\d[\d.]*\s*(donatur|donasi|program|laporan)\b/i);
    expect(OG_SRC).not.toMatch(/Rp\s?\d/);
  });

  it("LP-AC-05: strip statistik hanya tampil bila ada donasi paid (ambang ≥1)", () => {
    expect(STATS_MIN_PAID_DONATIONS).toBeGreaterThanOrEqual(1);
    expect(showPlatformStats(0)).toBe(false);
    expect(showPlatformStats(1)).toBe(true);
    expect(showPlatformStats(4, 5)).toBe(false);
    expect(showPlatformStats(0, 0)).toBe(false); // ambang tidak bisa diturunkan ke 0
  });

  it("LP-AC-07: FAQ ≥8 butir tampil; JSON-LD FAQPage identik dengan butir yang tampil", () => {
    const faq = visibleFaq();
    expect(faq.length).toBeGreaterThanOrEqual(8);
    const ld = JSON.parse(serializeJsonLd(faqJsonLd(faq))) as {
      "@type": string;
      mainEntity: {
        "@type": string;
        name: string;
        acceptedAnswer: { "@type": string; text: string };
      }[];
    };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      faq.map((f) => [f.question, f.answer]),
    );
    expect(
      ld.mainEntity.every(
        (q) => q["@type"] === "Question" && q.acceptedAnswer["@type"] === "Answer",
      ),
    ).toBe(true);
  });

  it("LP-AC-08: butir FAQ pending (OD-05, metode pembayaran) tidak tampil; tidak ada slot di copy tampil", () => {
    const pending = LANDING_FAQ.filter((f) => f.status === "pending");
    expect(pending.map((f) => f.question)).toEqual([
      "Apakah ada biaya tambahan saat berdonasi?",
      "Metode pembayaran apa saja yang tersedia?",
    ]);
    for (const p of pending) expect(visibleFaq()).not.toContainEqual(p);
    expect(JSON.stringify(visibleFaq())).not.toMatch(/\[(ISI DATA|VERIFIKASI)/);
    expect(PAGE_SRC).not.toMatch(/\[(ISI DATA|VERIFIKASI)/);
    expect(visibleFaq([{ question: "Q", answer: "[ISI DATA: x]", status: "ready" }])).toEqual([]);
  });

  it("LP-AC-09: blok legalitas & kalimat biaya operasional tidak dirender sampai diputuskan", () => {
    expect(LEGALITY_BLOCK).toBeNull();
    expect(OPERATIONAL_FEE_SENTENCE).toBeNull();
  });

  it("LP-AC-17 (diamandemen PM 11 Nov 2026): tiga klaim yang disetujui tetap ada; klaim terlarang lain tidak ada", () => {
    expect(PAGE_SRC).toContain("Donasi dalam hitungan detik");
    expect(PAGE_SRC).toContain("Semua program diverifikasi tim kami sebelum tayang.");
    expect(FOOTER_SRC).toContain("payment gateway berizin Bank Indonesia");
    const copy = PAGE_SRC + JSON.stringify(visibleFaq());
    for (const banned of [
      /100\s?% tersalurkan/i,
      /teraudit/i,
      /testimoni/i,
      /mitra/i,
      /sertifikasi/i,
      /penghargaan/i,
    ]) {
      expect(copy).not.toMatch(banned);
    }
  });
});

describe("landing page — state kosong (DB tanpa program/donasi)", () => {
  it("LP-AC-05: tanpa donasi paid → tiga fakta statis, tanpa Rp0/0", () => {
    const html = renderToStaticMarkup(
      createElement(TrustStripView, {
        stats: { collectedAmount: 0n, paidDonations: 0, publishedNews: 0 },
      }),
    );
    for (const f of ["Tanpa wajib daftar", "Kuitansi otomatis", "Rincian dana terbuka"])
      expect(html).toContain(f);
    expect(html).not.toMatch(/Rp|>0</);
    expect(html).not.toContain("Statistik platform");
  });

  it("LP-AC-05: dengan donasi paid → angka dari DB (bigint diformat rupiah)", () => {
    const html = renderToStaticMarkup(
      createElement(TrustStripView, {
        stats: { collectedAmount: 12_500_000n, paidDonations: 3, publishedNews: 2 },
      }),
    );
    expect(html).toContain("Statistik platform");
    expect(html).toMatch(/Rp\s?12\.500\.000/);
  });

  it("LP-AC-06/LP-AC-01: tanpa program unggulan → kartu tidak dirender, CTA primer ke /campaign, satu H1", () => {
    const html = renderToStaticMarkup(createElement(HeroView, { featured: null }));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Kebaikan kecil, dampak yang nyata.");
    expect(html.match(/<a[^>]*data-track-cta="primary"[^>]*>/)?.[0]).toContain('href="/campaign"');
    expect(html).not.toContain("Program Pilihan");
    expect(html).toContain("Tanpa wajib daftar · Kuitansi otomatis");
  });
});

describe("LP-AC-15: wrapper track()", () => {
  it("no-op di server (tanpa window)", () => {
    expect(() => track("donation_start", { campaign_slug: "a", source: "landing" })).not.toThrow();
  });

  it("no-op di browser bila Web Analytics tidak dimuat (di luar Vercel)", () => {
    vi.stubGlobal("window", {});
    expect(() =>
      track("landing_hero_cta_click", { cta: "primary", target: "/campaign" }),
    ).not.toThrow();
  });

  it("mengirim event dengan properti allowlist saja, tanpa PII", () => {
    const va = vi.fn();
    vi.stubGlobal("window", { va });
    track("landing_campaign_click", {
      campaign_slug: "renovasi-masjid",
      section: "urgent",
      // @ts-expect-error — properti di luar allowlist dibuang
      email: "a@b.test",
    });
    track("landing_hero_cta_click", { cta: "primary", target: "/campaign/renovasi-masjid" });
    track("donation_start", { campaign_slug: "renovasi-masjid", source: "landing" });
    track("donation_paid_view");
    expect(va.mock.calls).toEqual([
      [
        "event",
        {
          name: "landing_campaign_click",
          data: { campaign_slug: "renovasi-masjid", section: "urgent" },
          options: undefined,
        },
      ],
      [
        "event",
        {
          name: "landing_hero_cta_click",
          data: { cta: "primary", target: "/campaign/renovasi-masjid" },
          options: undefined,
        },
      ],
      [
        "event",
        {
          name: "donation_start",
          data: { campaign_slug: "renovasi-masjid", source: "landing" },
          options: undefined,
        },
      ],
      ["event", { name: "donation_paid_view", options: undefined }],
    ]);
  });

  it("nilai yang tidak berbentuk slug/path (email, nominal Rp, query) dibuang; maks. 2 properti", () => {
    expect(
      sanitizeProps("donation_start", { campaign_slug: "Budi@mail.com", source: "landing" }),
    ).toEqual({ source: "landing" });
    expect(
      sanitizeProps("landing_hero_cta_click", { cta: "primary", target: "/donasi/x?t=abc" }),
    ).toEqual({ cta: "primary" });
    for (const keys of Object.values(ANALYTICS_EVENTS)) expect(keys.length).toBeLessThanOrEqual(2);
  });

  it("kegagalan analytics tidak pernah dilempar", () => {
    vi.stubGlobal("window", {
      va: () => {
        throw new Error("blocked");
      },
    });
    expect(() => track("donation_paid_view")).not.toThrow();
  });

  it("URL analytics tanpa query/hash dan tanpa kode transaksi", () => {
    expect(sanitizeAnalyticsUrl("https://x.test/transaksi/TK-ABC123/berhasil?t=secret#h")).toBe(
      "https://x.test/transaksi/[code]/berhasil",
    );
    expect(sanitizeAnalyticsUrl("https://x.test/akun/donasi/TK-1?x=1")).toBe(
      "https://x.test/akun/donasi/[code]",
    );
    expect(sanitizeAnalyticsUrl("https://x.test/donasi/slug?ref=wa")).toBe(
      "https://x.test/donasi/slug",
    );
    expect(sanitizeAnalyticsUrl("bukan url")).toBe("");
  });
});

describe("halaman legal (T-49)", () => {
  it("empat halaman AC-32.1 dari satu sumber", () => {
    expect(LEGAL_PAGES.map((p) => p.path).sort()).toEqual([
      "/kebijakan-privasi",
      "/kontak",
      "/syarat-ketentuan",
      "/tentang",
    ]);
  });

  it("selama draf: banner draf ada, noindex; LEGAL_FINAL tidak boleh true selama masih ada slot", () => {
    expect(LEGAL_DRAFT_NOTICE).toBe(
      "Draf — menunggu tinjauan hukum. Belum berlaku sebagai dokumen final.",
    );
    expect(legalRobots(false)).toEqual({ index: false, follow: true });
    expect(legalRobots(true)).toBeUndefined();
    if (LEGAL_FINAL) expect(legalSlots()).toEqual([]);
    else expect(legalSlots().length).toBeGreaterThan(0);
  });

  it("tidak menyebut pasal undang-undang sebagai fakta (rujukan hukum lewat slot)", () => {
    const text = JSON.stringify(LEGAL_PAGES);
    expect(text).not.toMatch(/\bPasal\s+\d/i);
    expect(text).not.toMatch(/\bUU\s+(No\.?|Nomor)\s*\d/i);
  });

  it("AC-32.4: kontak hanya dari organization.*, nilai kosong disembunyikan", () => {
    expect(
      toOrganizationContact([
        { key: "organization.name", value: "Lembaga" },
        { key: "organization.email", value: "  " },
        { key: "organization.whatsapp", value: 62812 },
        { key: "organization.address", value: "Jl. Contoh" },
      ]),
    ).toEqual({ name: "Lembaga", address: "Jl. Contoh", email: undefined, whatsapp: undefined });
  });
});
