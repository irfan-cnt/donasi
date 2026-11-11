import { expect, test, type Page } from "./helpers/fixtures";

// P30 — landing page `/` (marketing/landing-page-implementation-brief.md §5, AC diberi prefix
// LP-AC agar tidak bentrok dengan AC produk). Data: seed sample Neon `dev` (ada program & donasi
// paid). State kosong (DB tanpa program/donasi) diuji di tests/unit/landing.test.ts.

type FaqLd = { "@type": string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
  return raw.map((r) => JSON.parse(r) as Record<string, unknown>);
}

test("LP-AC-01: tepat satu H1 berisi headline desain beranda (Nov 2026)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Kebaikan kecil berdampak Besar untuk sesama",
  );
  await expect(page.getByText("Tanpa wajib daftar akun")).toBeVisible();
  await expect(page.getByText("Kuitansi otomatis via email")).toBeVisible();
});

test("LP-AC-03: section berurutan S1→S8, lalu footer", async ({ page }) => {
  await page.goto("/");
  const order = await page
    .locator("[data-section]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-section")));
  const unique = order.filter((s, i) => s !== order[i - 1]);
  expect(unique).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]);
  const footerAfter = await page.evaluate(() => {
    const last = document.querySelector('[data-section="s8"]');
    const footer = document.querySelector("footer");
    return (
      !!last &&
      !!footer &&
      !!(last.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  });
  expect(footerAfter).toBe(true);
});

test("LP-AC-05: strip statistik dari DB (ada donasi paid di seed) tanpa angka tetap", async ({
  page,
}) => {
  await page.goto("/");
  const stats = page.getByRole("region", { name: "Statistik platform" });
  const facts = page.getByRole("region", { name: "Keunggulan platform" });
  // Tepat satu dari dua bentuk tampil (bergantung ada/tidaknya donasi paid di DB).
  expect((await stats.count()) + (await facts.count())).toBe(1);
  if (await stats.count()) await expect(stats).toContainText(/Rp\s?[\d.]+/);
  else await expect(facts).not.toContainText(/Rp|\b0\b/);
});

test("LP-AC-07/LP-AC-10: FAQ ≥8 butir; JSON-LD Organization & FAQPage valid dan identik dengan teks tampil", async ({
  page,
}) => {
  await page.goto("/");
  const faq = page.getByTestId("faq");
  const questions = (await faq.locator("summary h3").allTextContents()).map((t) => t.trim());
  const answers = (await faq.locator("details > p").allTextContents()).map((t) => t.trim());
  expect(questions.length).toBeGreaterThanOrEqual(8);
  const ld = await jsonLd(page);
  const org = ld.find((d) => Array.isArray(d["@graph"])) as
    { "@graph": { "@type": string }[] } | undefined;
  expect(org?.["@graph"].map((n) => n["@type"])).toContain("Organization");
  const faqLd = ld.find((d) => d["@type"] === "FAQPage") as FaqLd | undefined;
  expect(faqLd).toBeTruthy();
  expect(faqLd!.mainEntity.map((q) => q.name)).toEqual(questions);
  expect(faqLd!.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(answers);
});

test("LP-AC-08/LP-AC-09/LP-AC-17: tanpa slot data, tanpa blok legalitas, tanpa klaim terlarang", async ({
  page,
}) => {
  await page.goto("/");
  const html = await page.content();
  expect(html).not.toMatch(/\[(ISI DATA|VERIFIKASI|TINJAUAN HUKUM)/);
  await expect(page.getByTestId("legality-block")).toHaveCount(0);
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/100\s?% tersalurkan|teraudit|testimoni/i);
  // Klaim yang dipertahankan PM (11 Nov 2026).
  expect(text).toContain("Donasi dalam hitungan detik");
  expect(text).toContain("Semua program diverifikasi tim kami sebelum tayang.");
  await expect(page.locator("footer").first()).toContainText(
    "payment gateway berizin Bank Indonesia",
  );
  // Butir FAQ pending tidak tampil.
  await expect(page.getByText("Metode pembayaran apa saja yang tersedia?")).toHaveCount(0);
  await expect(page.getByText("Apakah ada biaya tambahan saat berdonasi?")).toHaveCount(0);
});

test("LP-AC-11: og:image dinamis merespons 200 bertipe gambar", async ({ page, request }) => {
  await page.goto("/");
  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(og).toContain("opengraph-image");
  const res = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^image\/png/);
  expect((await res.body()).byteLength).toBeGreaterThan(1000);
});

for (const width of [360, 768, 1280]) {
  test(`LP-AC-12: tanpa overflow horizontal di ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("LP-AC-13/LP-AC-15: konsol bersih; di luar Vercel analytics no-op (tanpa skrip/request)", async ({
  page,
}) => {
  const analytics: string[] = [];
  page.on("request", (r) => {
    if (/_vercel\/insights|vercel-scripts/.test(r.url())) analytics.push(r.url());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => typeof (window as { va?: unknown }).va)).toBe("undefined");
  await page.locator('#program a[href^="/campaign/"]:visible').first().click();
  await page.waitForURL(/\/campaign\/[a-z0-9-]+$/);
  expect(analytics).toEqual([]);
  // Penanda sumber landing hanya flag tanpa PII.
  expect(await page.evaluate(() => sessionStorage.getItem("tk:src:landing"))).toBe("1");
});

test("LP-AC-16: CTA & summary FAQ dapat dicapai dan diaktifkan dengan keyboard, fokus terlihat", async ({
  page,
}) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Donasi Sekarang" }).first();
  await cta.focus();
  await expect(cta).toBeFocused();
  const summary = page.getByTestId("faq").locator("summary").first();
  await summary.focus();
  await expect(summary).toBeFocused();
  const outline = await summary.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  const details = page.getByTestId("faq").locator("details").first();
  await expect(details).not.toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await expect(page.getByRole("link", { name: /Pilih Program Kebaikan/ })).toHaveAttribute(
    "href",
    "/#program",
  );
  await expect(page.getByRole("link", { name: "Jelajahi Semua Program" })).toHaveAttribute(
    "href",
    "/campaign",
  );
});

// T-49 (BUG-01): halaman legal draf.
for (const path of ["/kebijakan-privasi", "/syarat-ketentuan", "/tentang", "/kontak"]) {
  test(`T-49: ${path} draf — banner, tanggal, satu H1, noindex, canonical, tidak di sitemap`, async ({
    page,
    request,
  }) => {
    await page.goto(path);
    await expect(page.getByTestId("legal-draft-notice")).toHaveText(
      "Draf — menunggu tinjauan hukum. Belum berlaku sebagai dokumen final.",
    );
    await expect(page.getByText(/Terakhir diperbarui:/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await page.locator('meta[name="robots"]').first().getAttribute("content")).toContain(
      "noindex",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${path}$`),
    );
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain(path);
  });
}

test("AC-32.4: /kontak menampilkan data organization.* dari platform_settings tanpa secret", async ({
  page,
}) => {
  await page.goto("/kontak");
  const contact = page.getByTestId("organization-contact");
  await expect(contact).toContainText("Pengelola");
  const html = await page.content();
  expect(html).not.toMatch(
    /MIDTRANS_SERVER_KEY|SB-Mid-server|GMAIL_APP_PASSWORD|FONNTE_TOKEN|AUTH_SECRET|postgres(ql)?:\/\//,
  );
  await expect(page.locator("main form")).toHaveCount(0);
});
