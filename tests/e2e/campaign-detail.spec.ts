import { expect, test, type Page } from "./helpers/fixtures";
import { getCampaignId, getDonorPii, previewToken } from "./helpers/public-data";

// Data: seed sample di Neon branch `dev` (read-only di spec ini).
const PUBLISHED = "contoh-beasiswa-santri-penghafal-quran";
const NO_TARGET = "contoh-sedekah-subuh-harian";
const PAUSED = "contoh-dana-darurat-kemanusiaan";
const COMPLETED = "contoh-paket-hygiene-korban-banjir";
const DRAFT = "contoh-ambulans-gratis-dhuafa";
const MASJID = "contoh-renovasi-masjid-desa";

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  return JSON.parse(raw ?? "null");
}

/** CTA yang terlihat di viewport saat ini (sticky mobile atau kartu desktop). */
const visibleCta = (page: Page) =>
  page.locator('[data-testid="cta-mobile"], [data-testid="cta-desktop"]').locator("a:visible, button:visible").last();

test("detail published: konten, CTA, JSON-LD, canonical, OG, tanpa error konsol", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const res = await page.goto(`/campaign/${PUBLISHED}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Beasiswa Santri");
  await expect(page.getByRole("heading", { name: "Tentang program" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rincian penggunaan dana" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kabar terbaru" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Donatur & doa" })).toBeVisible();
  await expect(page.locator("p:visible", { hasText: /terkumpul dari Rp/ }).first()).toBeVisible();
  await expect(page.locator(":is(span,p):visible", { hasText: /\d+ donasi/ }).first()).toBeVisible();
  await expect(page.locator("span:visible", { hasText: /hari lagi|Hari terakhir/ }).first()).toBeVisible();
  const donors = page.getByTestId("donatur-list").locator("li");
  expect(await donors.count()).toBeGreaterThan(0);
  expect(await donors.count()).toBeLessThanOrEqual(10);
  // AC-02.5: tidak pernah "dari sekarang" untuk waktu lampau.
  await expect(page.locator("body")).not.toContainText("dari sekarang");
  const newsLinks = page.locator(`a[href^="/campaign/${PUBLISHED}/berita/"]`);
  expect(await newsLinks.count()).toBeGreaterThan(0);
  expect(await newsLinks.count()).toBeLessThanOrEqual(3);

  const cta = visibleCta(page);
  await expect(cta).toHaveText(/Donasi Sekarang/);
  await expect(cta).toHaveAttribute("href", `/donasi/${PUBLISHED}`);

  const ld = await jsonLd(page);
  expect(ld["@type"]).toBe("WebPage");
  expect(ld.potentialAction["@type"]).toBe("DonateAction");
  expect(ld.potentialAction.target).toMatch(new RegExp(`/donasi/${PUBLISHED}$`));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/campaign/${PUBLISHED}$`),
  );
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /images\/sample\/|blob/);
  await expect(page.locator(".prose-tk script")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("tanpa target: 'terkumpul · tanpa target'", async ({ page }) => {
  await page.goto(`/campaign/${NO_TARGET}`);
  await expect(page.locator("p:visible", { hasText: "terkumpul · tanpa target" }).first()).toBeVisible();
});

for (const [slug, label] of [
  [PAUSED, "Donasi dijeda"],
  [COMPLETED, "Program selesai"],
] as const) {
  test(`${label}: CTA nonaktif dengan alasan`, async ({ page }) => {
    const res = await page.goto(`/campaign/${slug}`);
    expect(res?.status()).toBe(200);
    const cta = visibleCta(page);
    await expect(cta).toHaveText(label);
    await expect(cta).toBeDisabled();
    await expect(page.locator(`a[href="/donasi/${slug}"]`)).toHaveCount(0);
    await expect(page.getByRole("status")).toBeVisible();
  });
}

test("draft & slug tak dikenal → 404", async ({ request }) => {
  expect((await request.get(`/campaign/${DRAFT}`)).status()).toBe(404);
  expect((await request.get("/campaign/tidak-ada-program-ini")).status()).toBe(404);
});

test("slug huruf besar → 301 ke slug kanonik", async ({ request }) => {
  const res = await request.get(`/campaign/${PUBLISHED.toUpperCase()}`, { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers().location).toMatch(new RegExp(`/campaign/${PUBLISHED}$`));
  const news = await request.get("/campaign/Contoh-Renovasi-Masjid-Desa/berita/berita-1", {
    maxRedirects: 0,
  });
  expect(news.status()).toBe(301);
  expect(news.headers().location).toMatch(/\/campaign\/contoh-renovasi-masjid-desa\/berita\/berita-1$/);
});

test("pratinjau draft: token sah → tampil; kedaluwarsa/campaign lain → 404", async ({ page, request }) => {
  const draftId = await getCampaignId(DRAFT);
  const ok = await page.goto(`/campaign/${DRAFT}/pratinjau?token=${previewToken(draftId)}`);
  expect(ok?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ambulans");
  await expect(page.getByText("Pratinjau — program belum dipublikasikan")).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.locator(`a[href="/donasi/${DRAFT}"]`)).toHaveCount(0);

  const expired = previewToken(draftId, Date.now() - 61 * 60_000);
  expect((await request.get(`/campaign/${DRAFT}/pratinjau?token=${expired}`)).status()).toBe(404);
  const other = previewToken(await getCampaignId(PUBLISHED));
  expect((await request.get(`/campaign/${DRAFT}/pratinjau?token=${other}`)).status()).toBe(404);
  expect((await request.get(`/campaign/${DRAFT}/pratinjau`)).status()).toBe(404);
});

test("detail berita: konten, kartu campaign + CTA, JSON-LD NewsArticle", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const res = await page.goto(`/campaign/${MASJID}/berita/berita-1`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Laporan penyaluran");
  await expect(page.getByText("Program terkait")).toBeVisible();
  const cta = page.getByTestId("cta-news").getByRole("link");
  await expect(cta).toHaveText(/Lanjutkan Kebaikan Ini/);
  await expect(cta).toHaveAttribute("href", `/donasi/${MASJID}`);
  const ld = await jsonLd(page);
  expect(ld["@type"]).toBe("NewsArticle");
  expect(ld.headline).toContain("Laporan penyaluran");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/campaign/${MASJID}/berita/berita-1$`),
  );
  expect(errors).toEqual([]);
});

test("berita draft / campaign salah / tak dikenal → 404", async ({ request }) => {
  // berita-3 milik campaign masjid = draft di seed.
  expect((await request.get(`/campaign/${MASJID}/berita/berita-3`)).status()).toBe(404);
  // berita-1 ada di campaign lain, bukan di campaign completed ini.
  expect((await request.get(`/campaign/${COMPLETED}/berita/berita-1`)).status()).toBe(404);
  expect((await request.get(`/campaign/${DRAFT}/berita/berita-1`)).status()).toBe(404);
  expect((await request.get(`/campaign/${MASJID}/berita/tidak-ada`)).status()).toBe(404);
});

test("email/WA donatur tidak pernah ada di HTML (AC-02.4)", async ({ request }) => {
  for (const slug of [PUBLISHED, NO_TARGET, MASJID, COMPLETED]) {
    const pii = await getDonorPii(slug);
    expect(pii.length).toBeGreaterThan(0);
    const html = (await (await request.get(`/campaign/${slug}`)).text()).toLowerCase();
    expect(html).toContain("donatur &amp; doa");
    for (const value of pii) expect(html, `bocor: ${value}`).not.toContain(value.toLowerCase());
    expect(html).not.toMatch(/@example\.com/);
  }
  const news = (await (await request.get(`/campaign/${MASJID}/berita/berita-1`)).text()).toLowerCase();
  expect(news).not.toMatch(/@example\.com|\+628000000/);
});

test("tanpa overflow horizontal di 360/768/1280 + screenshot", async ({ page }, testInfo) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [`/campaign/${PUBLISHED}`, `/campaign/${MASJID}/berita/berita-1`]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(0);
    }
    if (testInfo.project.name === "desktop" && process.env.SCREENSHOT_DIR) {
      await page.goto(`/campaign/${PUBLISHED}`);
      await page.screenshot({
        path: `${process.env.SCREENSHOT_DIR}/campaign-detail-${width}.png`,
        fullPage: true,
      });
    }
  }
});
