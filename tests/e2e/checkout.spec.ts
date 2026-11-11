import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "./helpers/fixtures";
import { cleanupCheckout, getActivePackages, getTransactionAmount } from "./helpers/checkout-data";
import { SESSION_COOKIE, cleanupDonorSession, seedDonorSession } from "./helpers/donor-session";

// Data: seed sample di Neon branch `dev`. Transaksi/donor yang dibuat dihapus di afterAll.
const OPEN = "contoh-beasiswa-santri-penghafal-quran";
const FIXED = "contoh-paket-sembako-dhuafa";
const PAUSED = "contoh-dana-darurat-kemanusiaan";
const DRAFT = "contoh-ambulans-gratis-dhuafa";

// Rate limit checkout per IP (10/jam, Upstash nyata) dipakai bersama antar-run: tiap test memakai
// IP uji unik (198.18.0.0/15, RFC 2544) lewat x-forwarded-for. Limiter produksi tidak diubah.
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.${18 + (octet() % 2)}.${octet()}.${octet()}` });
});

const emails: string[] = [];
const newEmail = () => {
  const e = `e2e+checkout-${randomUUID()}@example.test`;
  emails.push(e);
  return e;
};

test.afterAll(async () => {
  await cleanupCheckout(emails);
});

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

const submit = (page: Page) => page.getByRole("button", { name: "Pilih Pembayaran" });
const rp = (v: bigint) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
    .format(v)
    .replace(/ /g, " ");

test("open: nominal + data → halaman pembayaran (token sah saja)", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const res = await page.goto(`/donasi/${OPEN}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("list", { name: "Langkah donasi" })).toBeVisible();
  await page.locator("#amount-input").fill("75000");
  await expect(page.locator("#amount-input")).toHaveValue("75.000");
  await expect(page.getByTestId("checkout-total")).toHaveText("Rp 75.000");
  await page.getByLabel("Nama lengkap").fill("Donatur Uji E2E");
  await page.getByLabel("Email").fill(newEmail());
  // P26: nomor unik per run — limit checkout-phone 5/jam (P25, OD-31) dipakai bersama antar-run;
  // nomor tetap membuat run ke-3 dalam satu jam tertahan rate limit (flake terukur, bukan bug app).
  await page.getByLabel("No. WhatsApp").fill(`0812 ${String(randomInt(1e8)).padStart(8, "0")}`);
  await page.getByLabel("Doa atau pesan").fill("Semoga berkah");
  await submit(page).click();

  await page.waitForURL(new RegExp(`/donasi/${OPEN}/pembayaran\\?trx=TK-`));
  const url = new URL(page.url());
  const code = url.searchParams.get("trx")!;
  const token = url.searchParams.get("t")!;
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await expect(page.getByTestId("trx-code")).toHaveText(code);
  await expect(page.getByTestId("trx-amount")).toHaveText("Rp 75.000");
  expect(await getTransactionAmount(code)).toBe(75_000n);
  expect(errors).toEqual([]);

  // Token salah / tanpa token → 404, tidak membocorkan transaksi.
  const bad = await page.goto(`/donasi/${OPEN}/pembayaran?trx=${code}&t=${"A".repeat(43)}`);
  expect(bad?.status()).toBe(404);
  await expect(page.locator("body")).not.toContainText("Donatur Uji E2E");
  expect((await page.goto(`/donasi/${OPEN}/pembayaran?trx=${code}`))?.status()).toBe(404);
});

test("Gate M3: 9999999999999999 tertahan 13 digit dan ditolak batas", async ({ page }) => {
  await page.goto(`/donasi/${OPEN}`);
  const input = page.locator("#amount-input");
  await input.pressSequentially("9999999999999999");
  await expect(input).toHaveValue("9.999.999.999.999");
  await expect(page.getByText(/Maksimal donasi Rp 100\.000\.000 per transaksi/)).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  await input.fill("5000");
  await expect(page.getByText(/Minimal donasi Rp 10\.000/)).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  await input.fill("abc");
  await expect(input).toHaveValue("");
});

test("validasi inline: email & nama wajib", async ({ page }) => {
  await page.goto(`/donasi/${OPEN}`);
  await page.locator("#amount-input").fill("50000");
  await submit(page).click();
  await expect(page.getByText("Nama wajib diisi, atau aktifkan opsi Hamba Allah.")).toBeVisible();
  await expect(page.getByText("Masukkan email yang valid untuk menerima kuitansi.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/donasi/${OPEN}$`));
});

test("fixed: pilih paket → nominal dari DB di halaman pembayaran", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const packages = await getActivePackages(FIXED);
  expect(packages.length).toBeGreaterThan(0);
  await page.goto(`/donasi/${FIXED}`);
  const radios = page.getByRole("radio");
  await expect(radios).toHaveCount(packages.length);
  await expect(page.locator("#amount-input")).toHaveCount(0);
  const chosen = packages[packages.length - 1]!;
  await radios.last().click();
  await expect(page.getByTestId("checkout-total")).toHaveText(rp(chosen.amount));
  await page.getByText("Sembunyikan nama saya").click();
  await page.getByLabel("Email").fill(newEmail());
  await submit(page).click();
  await page.waitForURL(new RegExp(`/donasi/${FIXED}/pembayaran\\?trx=TK-`));
  await expect(page.getByTestId("trx-amount")).toHaveText(rp(chosen.amount));
  await expect(page.getByText("Hamba Allah", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("donatur login: prefill nama & email read-only", async ({ page, context, baseURL }) => {
  const seed = await seedDonorSession();
  try {
    await context.addCookies([{ name: SESSION_COOKIE, value: seed.sessionToken, url: baseURL! }]);
    await page.goto(`/donasi/${OPEN}`);
    await expect(page.getByLabel("Nama lengkap")).toHaveValue(seed.name);
    await expect(page.getByLabel("Email")).toHaveValue(seed.email);
    await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
    await expect(page.getByText("Masuk dengan Google")).toBeVisible();
  } finally {
    await cleanupDonorSession(seed);
  }
});

test("draft → 404; paused → donasi tidak tersedia", async ({ page }) => {
  expect((await page.goto(`/donasi/${DRAFT}`))?.status()).toBe(404);
  expect((await page.goto(`/donasi/tidak-ada-${randomUUID().slice(0, 8)}`))?.status()).toBe(404);
  await page.goto(`/donasi/${PAUSED}`);
  await expect(page.getByText("Donasi tidak tersedia")).toBeVisible();
  await expect(submit(page)).toHaveCount(0);
});

test("tanpa overflow horizontal di 360/768/1280 + screenshot", async ({ page }, testInfo) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [variant, slug] of [
      ["open", OPEN],
      ["fixed", FIXED],
    ] as const) {
      await page.goto(`/donasi/${slug}`);
      await expect(submit(page)).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${slug} @${width}`).toBeLessThanOrEqual(0);
      if (testInfo.project.name === "desktop" && process.env.SCREENSHOT_DIR) {
        await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/checkout-${variant}-${width}.png`, fullPage: true });
      }
    }
  }
});
