import { afterEach, describe, expect, it, vi } from "vitest";

// P24 (NFR-15): robots, sitemap (published saja), header noindex, bentuk JSON-LD schema.org.

const queries = vi.hoisted(() => ({
  getSitemapCampaigns: vi.fn(async () => [
    { slug: "masjid", updatedAt: new Date("2026-11-01T00:00:00Z") },
  ]),
  getSitemapNews: vi.fn(async () => [
    { slug: "masjid", newsSlug: "kabar-1", updatedAt: new Date("2026-11-02T00:00:00Z") },
  ]),
}));
vi.mock("@/server/queries/public-campaigns", () => queries);
vi.mock("@/lib/site", async (orig) => ({
  ...(await orig<typeof import("@/lib/site")>()),
  siteUrl: () => "https://tebar.example",
}));

const { default: robots } = await import("@/app/robots");
const { default: sitemap } = await import("@/app/sitemap");
const { NOINDEX_PATH_PATTERNS, ROBOTS_DISALLOW, isIndexable, robotsHeaderRules } = await import(
  "@/lib/seo"
);
const { campaignJsonLd, newsJsonLd, organizationJsonLd, serializeJsonLd } = await import(
  "@/lib/json-ld"
);

const ORIGINAL_APP_ENV = process.env.APP_ENV;
afterEach(() => {
  process.env.APP_ENV = ORIGINAL_APP_ENV;
});

describe("robots", () => {
  it("production: blokir area privat, sitemap tercantum", () => {
    process.env.APP_ENV = "production";
    const r = robots();
    const rule = [r.rules].flat()[0]!;
    for (const p of ["/admin", "/akun", "/transaksi", "/donasi/*/pembayaran", "/api"]) {
      expect(rule.disallow).toContain(p);
    }
    expect(rule.disallow).not.toContain("/");
    expect(r.sitemap).toBe("https://tebar.example/sitemap.xml");
  });

  it("preview/development: seluruh situs diblokir", () => {
    for (const env of ["preview", "development", undefined]) {
      process.env.APP_ENV = env;
      expect([robots().rules].flat()[0]!.disallow).toBe("/");
      expect(isIndexable()).toBe(false);
    }
  });
});

describe("X-Robots-Tag", () => {
  it("production: noindex untuk semua prefix privat", () => {
    const rules = robotsHeaderRules("production");
    expect(rules.map((r) => r.source)).toEqual([...NOINDEX_PATH_PATTERNS]);
    for (const p of ["/admin/:path*", "/akun/:path*", "/transaksi/:path*", "/donasi/:path*"]) {
      expect(rules.map((r) => r.source)).toContain(p);
    }
    expect(rules.every((r) => r.headers[0]!.value.includes("noindex"))).toBe(true);
  });

  it("non-production: noindex seluruh situs", () => {
    expect(robotsHeaderRules("preview")).toEqual([
      { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ]);
  });

  it("setiap prefix robots.txt juga punya header noindex", () => {
    for (const p of ROBOTS_DISALLOW) {
      const prefix = p.split("/*")[0]!;
      expect(NOINDEX_PATH_PATTERNS.some((s) => s.startsWith(prefix))).toBe(true);
    }
  });
});

describe("sitemap", () => {
  it("hanya URL publik: beranda, listing, campaign & berita published", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual([
      "https://tebar.example/",
      "https://tebar.example/campaign",
      "https://tebar.example/campaign/masjid",
      "https://tebar.example/campaign/masjid/berita/kabar-1",
    ]);
    expect(urls.some((u) => /pratinjau|token=|\/admin|\/akun|\/donasi|\/transaksi/.test(u))).toBe(
      false,
    );
    expect(new Set(urls).size).toBe(urls.length);
  });
});

// Validasi struktur minimal sesuai tipe schema.org yang dipakai (tanpa validator eksternal).
function expectAbsoluteUrl(v: unknown) {
  expect(typeof v).toBe("string");
  expect(new URL(v as string).protocol).toBe("https:");
}

describe("JSON-LD", () => {
  const site = "https://tebar.example";

  it("Organization + WebSite (beranda)", () => {
    const ld = organizationJsonLd(site, "Tebar Kebaikan");
    expect(ld["@context"]).toBe("https://schema.org");
    const [org, web] = ld["@graph"];
    expect(org!["@type"]).toBe("Organization");
    expectAbsoluteUrl(org!.url);
    expectAbsoluteUrl((org as { logo: string }).logo);
    expect(web!["@type"]).toBe("WebSite");
  });

  it("WebPage + DonateAction (detail campaign)", () => {
    const ld = campaignJsonLd({
      site,
      siteName: "Tebar Kebaikan",
      slug: "masjid",
      title: "Renovasi Masjid",
      description: "Deskripsi",
      imageUrl: "/images/a.png",
      updatedAt: new Date("2026-11-01T00:00:00Z"),
      donateHref: "/donasi/masjid",
      active: false,
    });
    expect(ld["@type"]).toBe("WebPage");
    expect(ld["@id"]).toBe(`${site}/campaign/masjid`);
    expect(ld.image).toBe(`${site}/images/a.png`);
    expect(ld.dateModified).toBe("2026-11-01T00:00:00.000Z");
    expect(ld.potentialAction["@type"]).toBe("DonateAction");
    expectAbsoluteUrl(ld.potentialAction.target);
    expect(ld.potentialAction.recipient["@type"]).toBe("Organization");
    expect(ld.potentialAction.actionStatus).toBe("https://schema.org/CompletedActionStatus");
  });

  it("NewsArticle (berita): headline ≤110, gambar absolut, publisher Organization", () => {
    const ld = newsJsonLd({
      site,
      siteName: "Tebar Kebaikan",
      campaignSlug: "masjid",
      campaignTitle: "Renovasi Masjid",
      newsSlug: "kabar-1",
      title: "x".repeat(200),
      description: null,
      imageUrl: "https://blob.example/a.jpg",
      publishedAt: new Date("2026-11-01T00:00:00Z"),
      updatedAt: new Date("2026-11-02T00:00:00Z"),
    });
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld.headline.length).toBe(110);
    ld.image.forEach(expectAbsoluteUrl);
    expect(ld.datePublished).toBe("2026-11-01T00:00:00.000Z");
    expect(ld.mainEntityOfPage["@id"]).toBe(`${site}/campaign/masjid/berita/kabar-1`);
    expect(ld.publisher["@type"]).toBe("Organization");
    expect(ld.publisher.logo["@type"]).toBe("ImageObject");
    expect("description" in JSON.parse(JSON.stringify(ld))).toBe(false);
  });

  it("serialisasi aman: teks DB tidak bisa menutup </script>", () => {
    const out = serializeJsonLd(
      campaignJsonLd({
        site,
        siteName: "T",
        slug: "s",
        title: "</script><script>alert(1)</script>",
        description: "&",
        imageUrl: null,
        updatedAt: new Date(0),
        donateHref: "/donasi/s",
        active: true,
      }),
    );
    expect(out).not.toMatch(/<\/script/i);
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
