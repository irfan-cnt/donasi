import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { cleanupCheckout, markSeededPaid, sandboxConfigured, seedTransaction } from "./helpers/checkout-data";

// P12 Instruksi / Berhasil / Menunggu + endpoint status. Data: Neon branch `dev` (seed sample,
// bca_va/bni_va/permata_va/mandiri_bill aktif). Charge sandbox di-expire & baris dihapus di afterAll.
const OPEN = "contoh-beasiswa-santri-penghafal-quran";
const SHOTS = process.env.P12_SCREENSHOT_DIR;

// IP uji sendiri agar checkout spec ini tidak menghabiskan kuota rate limit checkout-ip (10/jam)
// milik spec lain yang berbagi IP localhost di server yang sama.
test.use({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}` } });

const emails: string[] = [];
test.afterAll(async () => {
  await cleanupCheckout(emails);
});

const newEmail = () => {
  const e = `e2e+trx-${randomUUID()}@example.test`;
  emails.push(e);
  return e;
};

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function noOverflow(page: Page, name: string, shoot: boolean) {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, `overflow horizontal ${name} di ${width}px`).toBe(false);
    if (SHOTS && shoot && width !== 768) {
      await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true });
    }
  }
}

async function payWith(page: Page, method: RegExp): Promise<{ code: string; token: string }> {
  await page.goto(`/donasi/${OPEN}`);
  await page.locator("#amount-input").fill("50000");
  await page.getByLabel("Nama lengkap").fill("Donatur Uji Instruksi");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByRole("button", { name: "Pilih Pembayaran" }).click();
  await page.waitForURL(new RegExp(`/donasi/${OPEN}/pembayaran\\?trx=TK-`));
  await page.getByRole("radio", { name: method }).check();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  await page.waitForURL(/\/transaksi\/TK-[^/]+\/instruksi\?t=/, { timeout: 30_000 });
  const url = new URL(page.url());
  return { code: url.pathname.split("/")[2]!, token: url.searchParams.get("t")! };
}

test("instruksi VA (sandbox BNI): bank, nomor VA, salin, countdown, langkah; berhasil?status=paid → menunggu", async ({
  page,
  context,
  browserName,
}, info) => {
  test.skip(!sandboxConfigured(), "Midtrans sandbox tidak dikonfigurasi");
  const errors = collectConsoleErrors(page);
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { code, token } = await payWith(page, /BNI Virtual Account/);

  await expect(page.getByTestId("method-name")).toHaveText("BNI Virtual Account");
  await expect(page.getByTestId("bank-name")).toHaveText("BNI");
  const va = (await page.getByTestId("va-number").textContent())!.trim();
  expect(va).toMatch(/^\d{8,20}$/);
  await expect(page.getByTestId("countdown")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  await expect(page.getByTestId("poll-status")).toBeVisible();
  // Langkah dari payment_methods.instructions dengan placeholder terisi.
  await expect(page.getByText(`Masukkan nomor Virtual Account ${va}`).first()).toBeAttached();
  await expect(page.locator("text={{")).toHaveCount(0);

  await page.getByRole("button", { name: "Salin Nomor Virtual Account" }).click();
  await expect(page.getByText("Nomor Virtual Account disalin")).toBeVisible();
  if (browserName === "chromium") expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(va);

  await noOverflow(page, "instruksi-va", info.project.name === "desktop");

  // AC-07.1: query string diabaikan, status DB pending → menunggu.
  await page.goto(`/transaksi/${code}/berhasil?status=paid&t=${token}`);
  await expect(page).toHaveURL(new RegExp(`/transaksi/${code}/menunggu\\?t=`));
  await expect(page.getByTestId("payment-pending")).toBeVisible();
  await expect(page.getByTestId("trx-code")).toHaveText(code);
  await noOverflow(page, "menunggu", info.project.name === "desktop");
  expect(errors).toEqual([]);
});

test("instruksi Mandiri Bill (sandbox): kode perusahaan + kode bayar", async ({ page }, info) => {
  test.skip(!sandboxConfigured(), "Midtrans sandbox tidak dikonfigurasi");
  const errors = collectConsoleErrors(page);
  await payWith(page, /Mandiri Bill/);
  await expect(page.getByTestId("biller-code")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("bill-key")).toHaveText(/^\d+$/);
  await expect(page.getByRole("button", { name: "Salin Kode bayar (bill key)" })).toBeVisible();
  await noOverflow(page, "instruksi-mandiri", info.project.name === "desktop");
  expect(errors).toEqual([]);
});

test("payment kedaluwarsa → state expired + buat pembayaran baru", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending", expiresInMinutes: -5 });
  await page.goto(`/transaksi/${t.code}/instruksi?t=${t.token}`);
  await expect(page.getByTestId("payment-expired")).toBeVisible();
  await expect(page.getByText("Waktu pembayaran habis")).toBeVisible();
  await expect(page.getByRole("link", { name: "Buat pembayaran baru" })).toHaveAttribute(
    "href",
    new RegExp(`/donasi/${OPEN}/pembayaran\\?trx=${t.code}&t=`),
  );
  await noOverflow(page, "instruksi-expired", false);
  expect(errors).toEqual([]);
});

test("polling berhenti → tombol 'Cek status'; paid → berhasil (hook interval hanya non-production)", async ({
  page,
}, info) => {
  const errors = collectConsoleErrors(page);
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending" });
  await page.addInitScript(() => {
    window.__TK_POLL__ = { intervalMs: 200, maxMs: 1000 };
  });
  await page.goto(`/transaksi/${t.code}/instruksi?t=${t.token}`);
  await expect(page.getByTestId("va-number")).toHaveText("9880000000000001");
  const cek = page.getByRole("button", { name: "Cek status" });
  await expect(cek).toBeVisible({ timeout: 10_000 });

  // Simulasi hasil webhook terverifikasi pada baris seed → Cek status → halaman berhasil.
  await markSeededPaid(t.transactionId, t.paymentId);
  await cek.click();
  await page.waitForURL(new RegExp(`/transaksi/${t.code}/berhasil\\?t=`));
  await expect(page.getByTestId("payment-success")).toBeVisible();
  // P19: kuitansi tamu dengan access token transaksi.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("receipt-download").click()]);
  expect(download.suggestedFilename()).toMatch(/^kuitansi-KW-\d{4}-\d{6}\.pdf$/);
  const ok = await page.request.get(`/api/transactions/${t.code}/receipt?t=${t.token}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toBe("private, no-store, max-age=0");
  expect((await page.request.get(`/api/transactions/${t.code}/receipt?t=${"A".repeat(43)}`)).status()).toBe(404);
  await expect(page.getByText("Simpan riwayat donasimu")).toBeVisible();
  await noOverflow(page, "berhasil", info.project.name === "desktop");
  expect(errors).toEqual([]);
});

test("menunggu tanpa token (callback e-wallet) → halaman generik tanpa data transaksi", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending" });
  const res = await page.goto(`/transaksi/${t.code}/menunggu?order_id=x&result=success`);
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("payment-generic")).toBeVisible();
  // Kode hanya ada di URL; tidak ada data transaksi dari DB yang dirender.
  const text = await page.locator("body").innerText();
  expect(text).not.toContain(t.code);
  expect(text).not.toContain("50.000");
  expect(text).not.toContain(t.token);
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  expect(await page.locator('meta[name="referrer"]').getAttribute("content")).toBe("no-referrer");
  // Token salah tetap 404; kode tidak valid 404.
  expect((await page.goto(`/transaksi/${t.code}/menunggu?t=${"A".repeat(43)}`))?.status()).toBe(404);
  expect((await page.goto(`/transaksi/TK-BUKAN/menunggu`))?.status()).toBe(404);
  expect((await page.goto(`/transaksi/${t.code}/berhasil`))?.status()).toBe(404);
  await noOverflow(page, "menunggu-generik", false);
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

test("endpoint status: token salah 404, sah → {status, paidAt} no-store", async ({ request }) => {
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending" });
  const bad = await request.get(`/api/transactions/${t.code}/status?t=${"A".repeat(43)}`);
  expect(bad.status()).toBe(404);
  const ok = await request.get(`/api/transactions/${t.code}/status?t=${t.token}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toContain("no-store");
  expect(await ok.json()).toEqual({ status: "pending", paidAt: null });
});
