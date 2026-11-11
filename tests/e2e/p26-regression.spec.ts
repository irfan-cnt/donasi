import { randomUUID } from "node:crypto";
import { expect, test } from "./helpers/fixtures";
import { cleanupCheckout, seedTransaction } from "./helpers/checkout-data";

// P26: AC P0 yang sebelumnya belum punya test e2e langsung. Data: seed sample di Neon `dev`;
// transaksi seed dihapus di afterAll.
const OPEN = "contoh-beasiswa-santri-penghafal-quran";
const LEGAL = ["/kebijakan-privasi", "/syarat-ketentuan", "/tentang", "/kontak"] as const;

const emails: string[] = [];
test.afterAll(async () => {
  await cleanupCheckout(emails);
});
const newEmail = () => {
  const e = `e2e+p26-${randomUUID()}@example.test`;
  emails.push(e);
  return e;
};

test("AC-01.4: kartu campaign memuat judul, gambar ber-alt, terkumpul, progress & sisa hari", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('#program a[href^="/campaign/"]:visible').first();
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading")).not.toHaveText("");
  const alt = await card.locator("img").first().getAttribute("alt");
  expect(alt?.trim().length ?? 0).toBeGreaterThan(0);
  await expect(card).toContainText(/Rp\s?[\d.]+/);
  await expect(card).toContainText(/hari lagi|Berlangsung|Selesai/);
});

test("AC-02.3: di mobile CTA 'Donasi Sekarang' menempel di bawah layar saat digulir", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/campaign/${OPEN}`);
  const cta = page.getByTestId("cta-mobile");
  await expect(cta).toBeVisible();
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(300);
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.y + box!.height)).toBeLessThanOrEqual(740);
  expect(box!.y).toBeGreaterThan(740 / 2);
  await expect(cta.getByRole("link", { name: /Donasi Sekarang/ })).toBeVisible();
});

test("AC-08.3: halaman menunggu → tombol 'Lihat instruksi' kembali ke instruksi", async ({ page }) => {
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending" });
  await page.goto(`/transaksi/${t.code}/menunggu?t=${t.token}`);
  await page.getByRole("link", { name: "Lihat instruksi" }).click();
  await page.waitForURL(new RegExp(`/transaksi/${t.code}/instruksi\\?t=`));
  await expect(page.getByTestId("va-number")).toHaveText("9880000000000001");
});

for (const path of LEGAL) {
  test(`AC-32.1: ${path} dapat diakses publik tanpa login (200)`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
  });
}

for (const path of ["/", "/campaign", `/campaign/${OPEN}`, "/masuk"]) {
  test(`AC-32.2: footer ${path} menautkan keempat halaman legal`, async ({ page }) => {
    await page.goto(path);
    for (const href of LEGAL) await expect(page.locator(`footer a[href="${href}"]`).first()).toBeAttached();
  });
}

test("AC-32.3: teks persetujuan Checkout Form menautkan S&K dan Kebijakan Privasi", async ({ page }) => {
  await page.goto(`/donasi/${OPEN}`);
  const consent = page.getByText(/Dengan melanjutkan, kamu menyetujui/);
  await expect(consent).toBeVisible();
  await expect(consent.locator('a[href="/syarat-ketentuan"]')).toHaveCount(1);
  await expect(consent.locator('a[href="/kebijakan-privasi"]')).toHaveCount(1);
});
