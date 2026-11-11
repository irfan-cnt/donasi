import { expect, test, type Page } from "./helpers/fixtures";
import { ADMIN_COOKIE, cleanupAdmin, seedAdmin, seedAdminSession, type SeededAdmin } from "./helpers/admin-session";

// P20 — shell admin & dashboard dengan sesi admin yang di-seed langsung ke DB (Neon dev).
const seeded: SeededAdmin[] = [];
const SHOT_DIR = process.env.P20_SCREENSHOT_DIR;

test.afterEach(async () => {
  while (seeded.length) await cleanupAdmin(seeded.pop()!);
});

async function loginAs(page: Page, baseURL: string | undefined, role: "owner" | "finance" | "editor") {
  const admin = await seedAdmin({ role, totpEnabled: true, name: `Uji ${role}` });
  seeded.push(admin);
  const token = await seedAdminSession(admin.id);
  await page.context().addCookies([{ name: ADMIN_COOKIE, value: token, url: baseURL ?? "http://localhost:3100" }]);
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("dashboard admin (P20)", () => {
  test("owner: shell & dashboard responsif 360/768/1280 tanpa overflow & error konsol", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "viewport diatur manual; cukup sekali");
    const errors = trackErrors(page);
    await loginAs(page, baseURL, "owner");
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByTestId("kpi-paid-amount")).toContainText("Rp");
      await expect(page.getByTestId("kpi-active-campaigns")).toBeVisible();
      await expect(page.getByTestId("latest-transactions")).toBeVisible();
      await expect(page.getByTestId("env-badge")).toHaveText("Sandbox");
      const sidebar = page.getByRole("complementary");
      if (width >= 1024) {
        await expect(sidebar.getByRole("link", { name: "Audit Log" })).toBeVisible();
        await expect(page.getByTestId("admin-menu-button")).toBeHidden();
      } else {
        await expect(page.getByTestId("admin-menu-button")).toBeVisible();
      }
      expect(await noOverflow(page), `overflow di ${width}px`).toBe(true);
      if (SHOT_DIR && (width === 360 || width === 1280)) {
        await page.screenshot({ path: `${SHOT_DIR}/dashboard-owner-${width}.png`, fullPage: true });
      }
    }
    // Filter 7 hari & rentang khusus (URL → server, zona WIB).
    await page.getByLabel("Rentang waktu").selectOption("7");
    await expect(page).toHaveURL(/rentang=7/);
    await expect(page.getByTestId("dashboard-range")).toContainText("(7 hari)");
    await page.goto("/admin?dari=2026-11-01&sampai=2026-11-03");
    await expect(page.getByTestId("dashboard-range")).toContainText("(3 hari)");
    expect(errors).toEqual([]);
  });

  test("drawer mobile berisi menu dan bisa navigasi", async ({ page, baseURL }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 360, height: 780 });
    await loginAs(page, baseURL, "finance");
    await page.goto("/admin");
    await page.getByTestId("admin-menu-button").click();
    const drawer = page.getByTestId("admin-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(drawer.getByRole("link", { name: "Template" })).toHaveCount(0); // finance: tanpa notifications.write
    await drawer.getByRole("link", { name: "Donatur" }).click();
    await expect(page).toHaveURL(/\/admin\/donatur$/);
    await expect(page.getByRole("heading", { level: 1, name: "Donatur" }).filter({ visible: true })).toBeVisible(); // P22: halaman nyata
    await expect(drawer).toBeHidden();
    expect(await noOverflow(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("editor: hanya widget campaign, menu terbatas, transaksi 403, pencarian sesuai izin", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, baseURL, "editor");
    await page.goto("/admin");
    await expect(page.getByTestId("kpi-active-campaigns")).toBeVisible();
    await expect(page.getByTestId("campaign-performance")).toBeVisible();
    await expect(page.getByTestId("kpi-paid-amount")).toHaveCount(0);
    await expect(page.getByTestId("latest-transactions")).toHaveCount(0);
    await expect(page.getByTestId("daily-chart")).toHaveCount(0);
    const nav = page.getByRole("complementary").getByRole("navigation", { name: "Menu admin" });
    await expect(nav.getByRole("link")).toHaveText(["Dashboard", "Campaign", "Berita"]);

    const search = page.getByTestId("admin-search");
    await search.fill("TK-261111-ABCDEF");
    await expect(page.getByTestId("admin-search-results")).toContainText("Tidak ada hasil.");
    await search.fill("beasiswa");
    await expect(page.getByTestId("admin-search-results")).toContainText("Campaign");

    await page.goto("/admin/transaksi");
    await expect(page.getByRole("heading", { name: "Akses ditolak" })).toBeVisible();
  });

  test("finance: pencarian kode transaksi seed menampilkan hasil", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "cukup sekali");
    await loginAs(page, baseURL, "finance");
    await page.goto("/admin");
    const code = (await page.getByTestId("latest-transactions").locator("td.font-mono").first().textContent())?.trim();
    test.skip(!code, "tidak ada transaksi pada 30 hari terakhir di dev");
    await page.getByTestId("admin-search").fill(code!);
    await expect(page.getByTestId("admin-search-results")).toContainText(code!);
  });
});
