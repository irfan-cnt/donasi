import { expect, test, type Page } from "./helpers/fixtures";

// Data: seed sample di Neon branch `dev` (4 campaign published: pendidikan, lainnya,
// yatim-dhuafa, masjid). Kategori `kesehatan` hanya berisi draft → dipakai untuk empty state
// tanpa menghapus data.

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("home merender hero, satu H1, daftar program, tanpa error konsol", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Kebaikan kecil/);
  await expect(page.getByRole("heading", { name: "Pilih program kebaikan" })).toBeVisible();
  await expect(page.locator('#program a[href^="/campaign/"]:visible').first()).toBeVisible();
  // Tidak ada campaign draft/paused (AC-01.1).
  await expect(page.locator('a[href="/campaign/contoh-ambulans-gratis-dhuafa"]')).toHaveCount(0);
  await expect(page.locator('a[href="/campaign/contoh-dana-darurat-kemanusiaan"]')).toHaveCount(0);
  // Tanpa pop-up otomatis (AC-01.3).
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("filter kategori memperbarui URL & daftar tanpa full reload", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  const filter = page.getByRole("navigation", { name: "Filter kategori" });
  await filter.getByRole("link", { name: "Masjid" }).click();
  await expect(page).toHaveURL(/\?kategori=masjid$/);
  await expect(filter.getByRole("link", { name: "Masjid" })).toHaveAttribute("aria-current", "page");
  const cards = page.locator('#program a[href^="/campaign/"]:visible');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("href", "/campaign/contoh-renovasi-masjid-desa");
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  expect(errors).toEqual([]);
});

test("slug kategori tidak valid diabaikan", async ({ page }) => {
  await page.goto("/?kategori=tidak-ada");
  const filter = page.getByRole("navigation", { name: "Filter kategori" });
  await expect(filter.getByRole("link", { name: "Semua" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator('#program a[href^="/campaign/"]:visible').first()).toBeVisible();
});

test("empty state saat kategori tanpa campaign published", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/?kategori=kesehatan");
  await expect(page.getByTestId("empty-state")).toContainText("Belum ada program di kategori ini");
  await expect(page.locator('#program a[href^="/campaign/"]')).toHaveCount(0);
  // P30: hero kini juga punya "Lihat Semua Program" (→ /campaign); tautan empty state yang diuji.
  await page.getByTestId("empty-state").getByRole("link", { name: "Lihat semua program" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("listing /campaign: H1, canonical, bagian selesai terpisah, empty state", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/campaign");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/campaign$/);
  await expect(page.getByRole("heading", { name: "Program selesai" })).toBeVisible();
  await expect(page.locator('a[href="/campaign/contoh-paket-hygiene-korban-banjir"]:visible')).toHaveCount(1);
  await expect(page.locator('a[href="/campaign/contoh-dana-darurat-kemanusiaan"]')).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await page.goto("/campaign?kategori=kesehatan");
  await expect(page.getByTestId("empty-state")).toBeVisible();
  expect(errors).toEqual([]);
});

test("robots.txt sesuai lingkungan dan sitemap hanya berisi URL publik", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  if (/^Disallow: \/$/m.test(robots)) {
    // Non-production (dev/preview): seluruh situs ditutup + header noindex (P24).
    const home = await request.get("/");
    expect(home.headers()["x-robots-tag"]).toContain("noindex");
  } else {
    for (const path of ["/admin", "/akun", "/transaksi", "/donasi/*/pembayaran", "/api"]) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/campaign/contoh-renovasi-masjid-desa");
  expect(xml).toMatch(/\/campaign\/[a-z0-9-]+\/berita\/[a-z0-9-]+</);
  expect(xml).not.toContain("contoh-ambulans-gratis-dhuafa");
  expect(xml).not.toMatch(/pratinjau|token=|\/admin|\/akun|\/donasi\/|\/transaksi/);
});

test("metadata publik unik + canonical, JSON-LD valid; halaman privat noindex", async ({ page, request }) => {
  const publicPaths = ["/", "/campaign", "/campaign/contoh-renovasi-masjid-desa"];
  const titles = new Set<string>();
  const canonicals = new Set<string>();
  for (const path of publicPaths) {
    await page.goto(path);
    titles.add(await page.title());
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBeTruthy();
    canonicals.add(canonical!);
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
    expect(await page.locator('meta[property="og:image"]').first().getAttribute("content")).toBeTruthy();
    for (const raw of await page.locator('script[type="application/ld+json"]').allTextContents()) {
      const ld = JSON.parse(raw) as Record<string, unknown>;
      expect(ld["@context"]).toBe("https://schema.org");
    }
  }
  expect(titles.size).toBe(publicPaths.length);
  expect(canonicals.size).toBe(publicPaths.length);

  for (const path of ["/masuk", "/donasi/contoh-renovasi-masjid-desa", "/admin/masuk"]) {
    const res = await request.get(path);
    expect(res.headers()["x-robots-tag"], path).toContain("noindex");
    await page.goto(path);
    expect(await page.locator('meta[name="robots"]').first().getAttribute("content"), path).toContain(
      "noindex",
    );
  }
});

for (const width of [360, 768, 1280]) {
  test(`tanpa overflow horizontal di lebar ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/campaign", "/?kategori=kesehatan"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
}
