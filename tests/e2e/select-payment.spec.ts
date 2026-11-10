import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanupCheckout, sandboxConfigured } from "./helpers/checkout-data";

// P11 Select Payment. Data: seed sample di Neon branch `dev` (provider midtrans + bca_va/bni_va/
// permata_va/mandiri_bill aktif di dev). Charge sandbox di-expire & baris dihapus di afterAll.
const OPEN = "contoh-beasiswa-santri-penghafal-quran";
const SHOTS = process.env.P11_SCREENSHOT_DIR;

const emails: string[] = [];
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

async function checkoutToPayment(page: Page, amount = "50000"): Promise<{ code: string; token: string }> {
  const email = `e2e+pay-${randomUUID()}@example.test`;
  emails.push(email);
  await page.goto(`/donasi/${OPEN}`);
  await page.locator("#amount-input").fill(amount);
  await page.getByLabel("Nama lengkap").fill("Donatur Uji Bayar");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Pilih Pembayaran" }).click();
  await page.waitForURL(new RegExp(`/donasi/${OPEN}/pembayaran\\?trx=TK-`));
  const url = new URL(page.url());
  return { code: url.searchParams.get("trx")!, token: url.searchParams.get("t")! };
}

test("menampilkan metode aktif per grup tanpa overflow (360/768/1280)", async ({ page }, info) => {
  const errors = collectConsoleErrors(page);
  await checkoutToPayment(page);
  const va = page.getByRole("group", { name: "Virtual Account" });
  await expect(va).toBeVisible();
  await expect(va.getByRole("radio")).toHaveCount(4);
  await expect(page.getByText("BCA Virtual Account")).toBeVisible();
  await expect(page.getByText("Mandiri Bill Payment")).toBeVisible();
  // Metode nonaktif di dev tidak tampil.
  await expect(page.getByText("BRI Virtual Account")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Bayar Rp/ })).toBeEnabled();

  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, `overflow horizontal di ${width}px`).toBe(false);
    if (SHOTS && info.project.name === "desktop") {
      await page.screenshot({ path: `${SHOTS}/select-payment-${width}.png`, fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test("pilih VA → payment sandbox dibuat → halaman instruksi (placeholder)", async ({ page }) => {
  test.skip(!sandboxConfigured(), "Midtrans sandbox tidak dikonfigurasi");
  const errors = collectConsoleErrors(page);
  const { code, token } = await checkoutToPayment(page);
  await page.getByRole("radio", { name: /BNI Virtual Account/ }).check();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  await page.waitForURL(new RegExp(`/transaksi/${code}/instruksi\\?t=`), { timeout: 30_000 });
  expect(new URL(page.url()).searchParams.get("t")).toBe(token);
  const summary = page.getByRole("region", { name: "Ringkasan pembayaran" });
  await expect(summary.getByTestId("trx-code")).toHaveText(code);
  await expect(summary.getByTestId("payment-status")).toHaveText("Menunggu pembayaran");
  expect(errors).toEqual([]);
});

test("token salah → 404 di halaman pembayaran & instruksi", async ({ page }) => {
  const { code } = await checkoutToPayment(page);
  const bad = "A".repeat(43);
  expect((await page.goto(`/donasi/${OPEN}/pembayaran?trx=${code}&t=${bad}`))?.status()).toBe(404);
  expect((await page.goto(`/transaksi/${code}/instruksi?t=${bad}`))?.status()).toBe(404);
  expect((await page.goto(`/transaksi/${code}/instruksi`))?.status()).toBe(404);
});
