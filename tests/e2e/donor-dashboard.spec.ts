import { expect, test, type Page } from "@playwright/test";
import { cleanupDashboard, DASH_CAMPAIGN, getDonorProfile, plantGuestDonor, seedDashboard } from "./helpers/donor-dashboard-data";
import { SESSION_COOKIE, cleanupDonorSession, seedDonorSession, type SeededDonorSession } from "./helpers/donor-session";

// P18: dashboard donatur dengan sesi Auth.js yang di-seed langsung ke DB (tanpa Google nyata).
let seed: SeededDonorSession | undefined;
let donorIds: string[] = [];

test.afterEach(async () => {
  await cleanupDashboard(donorIds);
  if (seed) await cleanupDonorSession(seed);
  seed = undefined;
  donorIds = [];
});

async function login(page: Page, baseURL: string, opts?: Parameters<typeof seedDashboard>[1]) {
  seed = await seedDonorSession();
  const data = await seedDashboard(seed, opts);
  donorIds = [data.donorId, data.otherDonorId];
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: seed.sessionToken, url: baseURL, httpOnly: true, sameSite: "Lax" },
  ]);
  return data;
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test("dashboard: ringkasan, pending CTA, donasi terbaru (AC-12.1)", async ({ page, baseURL }) => {
  const errors = collectConsoleErrors(page);
  const data = await login(page, baseURL!);
  await page.goto("/akun");
  await expect(page.getByRole("heading", { name: /Donatur E2E/ })).toBeVisible();
  await expect(page.getByTestId("stat-total")).toHaveText(/Rp\s?225\.000/);
  await expect(page.getByTestId("stat-paid")).toHaveText("2");
  await expect(page.getByTestId("stat-pending")).toHaveText("1");
  await expect(page.getByTestId("pending-cta")).toBeVisible();
  await expect(page.getByTestId("trx-item")).toHaveCount(4);
  await expect(page.getByText(data.other.code)).toHaveCount(0);

  // Lanjut bayar (status created) → halaman pilih pembayaran dengan token baru.
  await page.getByRole("button", { name: "Lanjutkan bayar" }).click();
  await expect(page).toHaveURL(new RegExp(`/donasi/${DASH_CAMPAIGN}/pembayaran\\?trx=${data.created.code}&t=`));
  expect(errors).toEqual([]);
});

test("riwayat: filter status & tahun", async ({ page, baseURL }) => {
  const errors = collectConsoleErrors(page);
  const data = await login(page, baseURL!);
  await page.goto("/akun/donasi");
  await expect(page.getByTestId("trx-item")).toHaveCount(4);
  await page.getByLabel("Filter status").selectOption("paid");
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page).toHaveURL(/status=paid/);
  await expect(page.getByTestId("trx-item")).toHaveCount(2);
  await page.getByLabel("Filter tahun").selectOption("2025");
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page.getByTestId("trx-item")).toHaveCount(1);
  await expect(page.getByTestId("trx-item")).toHaveAttribute("href", `/akun/donasi/${data.paidOld.code}`);
  await page.goto("/akun/donasi?status=bukan&tahun=abc&setelah=rusak");
  await expect(page.getByTestId("trx-item")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("detail milik sendiri tampil; kode milik donor lain → 404 (AC-13.1)", async ({ page, baseURL }) => {
  const errors = collectConsoleErrors(page);
  const data = await login(page, baseURL!);
  await page.goto(`/akun/donasi/${data.paid.code}`);
  await expect(page.getByTestId("trx-code")).toHaveText(data.paid.code);
  await expect(page.getByTestId("timeline")).toContainText("Donasi dibuat");
  await expect(page.getByRole("button", { name: /Kuitansi Donasi/ })).toBeDisabled();
  expect(errors).toEqual([]);

  const other = await page.goto(`/akun/donasi/${data.other.code}`);
  expect(other?.status()).toBe(404);
  await expect(page.getByText(data.other.code)).toHaveCount(0);
  const bogus = await page.goto("/akun/donasi/TK-000000-AAAAAA");
  expect(bogus?.status()).toBe(404);
});

test("lanjut bayar transaksi milik donor lain lewat action → 404, token tidak berubah", async ({ page, baseURL }) => {
  const data = await login(page, baseURL!);
  await page.goto(`/akun/donasi/${data.created.code}`);
  // Ganti kode di form (manipulasi client) ke milik donor lain sebelum submit — setelah hidrasi
  // selesai agar React tidak menimpa nilai input.
  await page.waitForLoadState("networkidle");
  await page.locator('input[name="code"]').evaluate((el, code) => ((el as HTMLInputElement).value = code), data.other.code);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Lanjutkan bayar" }).click(),
  ]);
  expect(response.status()).toBe(404);
  await expect(page).not.toHaveURL(/\/transaksi\/|\/pembayaran/);
});

test("profil: ubah nama, WA (+62), preferensi; dihormati di prefill checkout (AC-15.x)", async ({ page, baseURL }) => {
  const errors = collectConsoleErrors(page);
  const data = await login(page, baseURL!, { phone: "+6281200001111", whatsappOptIn: true });
  await page.goto("/akun/profil");
  await expect(page.getByLabel("Email (dari Google)")).toHaveValue(seed!.email);
  await expect(page.getByLabel("Email (dari Google)")).toBeDisabled();

  await page.getByLabel("No. WhatsApp").fill("12345");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByTestId("phone-error")).toBeVisible();

  await page.getByLabel("Nama tampilan").fill("Hamba Uji");
  await page.getByLabel("No. WhatsApp").fill("0812-3456-7890");
  await page.getByRole("switch", { name: "Notifikasi WhatsApp" }).click();
  await page.getByRole("switch", { name: "Selalu sembunyikan nama saya" }).click();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Profil tersimpan")).toBeVisible();
  await expect
    .poll(() => getDonorProfile(data.donorId))
    .toMatchObject({ name: "Hamba Uji", phone_e164: "+6281234567890", whatsapp_opt_in: false, default_anonymous: true });

  // Prefill checkout: WA opt-out → checkbox WA tidak dicentang; anonim default aktif.
  await page.goto(`/donasi/${DASH_CAMPAIGN}`);
  await expect(page.getByRole("checkbox", { name: "Persetujuan WhatsApp" })).not.toBeChecked();
  await expect(page.locator('input[name="anonymous"]')).toHaveValue("on");
  expect(errors).toEqual([]);
});

test("tanpa overflow 360/768/1280 + screenshot", async ({ page, baseURL }, info) => {
  const data = await login(page, baseURL!);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ["akun", "/akun"],
      ["donasi", "/akun/donasi"],
      ["detail", `/akun/donasi/${data.paid.code}`],
      ["profil", "/akun/profil"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(0);
      if (info.project.name === "desktop" && process.env.SCREENSHOT_DIR && width !== 768) {
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}-${width}.png`, fullPage: true });
      }
    }
  }
});

test("donor tamu yang ditanam dengan email korban → prefill checkout bersih setelah login (M1)", async ({ page, baseURL }) => {
  seed = await seedDonorSession();
  donorIds = [await plantGuestDonor(seed.email)];
  await page.context().addCookies([
    { name: SESSION_COOKIE, value: seed.sessionToken, url: baseURL!, httpOnly: true, sameSite: "Lax" },
  ]);
  await page.goto(`/donasi/${DASH_CAMPAIGN}`);
  await expect(page.getByLabel(/No\. WhatsApp/)).toHaveValue("");
  await expect(page.locator('input[name="anonymous"]')).toHaveValue("");
  // Checkbox WA baru muncul setelah nomor diisi; default dari profil (opt-in direset → tidak dicentang).
  await page.getByLabel(/No\. WhatsApp/).fill("081234567890");
  await expect(page.getByRole("checkbox", { name: "Persetujuan WhatsApp" })).not.toBeChecked();
  await expect
    .poll(() => getDonorProfile(donorIds[0]!))
    .toMatchObject({ phone_e164: null, whatsapp_opt_in: false, default_anonymous: false });
});
