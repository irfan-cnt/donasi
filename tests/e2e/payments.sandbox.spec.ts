// P15 (T-27) — E2E Midtrans SANDBOX terhadap deployment preview. Tag @sandbox.
// Jalankan: SANDBOX_BASE_URL=https://<preview> pnpm test:e2e --project=sandbox
// (tanpa SANDBOX_BASE_URL suite dilewati; header bypass Vercel diisi playwright.config.ts dari env).
// Data: campaign "[UJI SANDBOX]" khusus, donor e2e-sandbox+…@example.test, Neon branch `dev`.
// Status `paid` hanya terjadi lewat webhook Midtrans asli setelah bayar di Simulator (BR-18).
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  FIXED_SLUG,
  OPEN_SLUG,
  backdateExpiry,
  campaignTotals,
  ensureTestCampaigns,
  eventSnippet,
  expireLeftoverCharges,
  isMethodActive,
  midtransStatus,
  newEmail,
  payments,
  probeChannel,
  signQStash,
  signedNotification,
  type PaymentRow,
} from "./helpers/sandbox-data";

const BASE = process.env.SANDBOX_BASE_URL?.replace(/\/+$/, "");
const SHOTS = process.env.SANDBOX_SCREENSHOT_DIR;
const SIM = "https://simulator.sandbox.midtrans.com";

test.skip(!BASE, "SANDBOX_BASE_URL tidak diisi — suite @sandbox hanya untuk deployment preview");
test.describe.configure({ mode: "serial" });

const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const note = (type: string, description: string) =>
  test.info().annotations.push({ type, description });

test.beforeAll(async () => {
  await ensureTestCampaigns();
});
test.afterAll(async () => {
  await expireLeftoverCharges();
});

async function checkout(page: Page, slug: string, amount?: string) {
  await page.goto(`/donasi/${slug}`);
  if (amount) await page.locator("#amount-input").fill(amount);
  else await page.getByRole("radio").first().click();
  await page.getByLabel("Nama lengkap").fill("Donatur Uji Sandbox");
  await page.getByLabel("Email").fill(newEmail());
  await page.getByRole("button", { name: "Pilih Pembayaran" }).click();
  await page.waitForURL(new RegExp(`/donasi/${slug}/pembayaran\\?trx=TK-`), { timeout: 30_000 });
  const url = new URL(page.url());
  return { code: url.searchParams.get("trx")!, payUrl: url.pathname + url.search };
}

async function pay(page: Page, code: string, method: RegExp) {
  await page.getByRole("radio", { name: method }).check();
  await page.getByRole("button", { name: /^Bayar Rp/ }).click();
  await page.waitForURL(new RegExp(`/transaksi/${code}/instruksi\\?t=`), { timeout: 45_000 });
}

async function waitStatus(code: string, status: string, timeout = 120_000): Promise<PaymentRow> {
  let last: PaymentRow | undefined;
  await expect
    .poll(async () => ((last = (await payments(code)).at(-1)), last?.status), {
      timeout,
      intervals: [3000],
    })
    .toBe(status);
  return last!;
}

/** Simulator dibuka di context TERPISAH tanpa header bypass (secret tidak pernah dikirim ke Midtrans). */
async function simulatorPay(
  browser: Browser,
  path: string,
  fill: (p: Page) => Promise<void>,
  name: string,
) {
  const ctx = await browser.newContext({ extraHTTPHeaders: {}, baseURL: undefined });
  const sim = await ctx.newPage();
  const leaked: string[] = [];
  sim.on("request", (r) => {
    if (r.headers()["x-vercel-protection-bypass"]) leaked.push(new URL(r.url()).host);
  });
  try {
    await sim.goto(`${SIM}${path}`);
    await fill(sim);
    await sim.locator('input[type="submit"][value="Inquire"]').click();
    await sim.waitForLoadState("domcontentloaded");
    await shot(sim, `${name}-simulator-inquiry`);
    await sim.locator('input[type="submit"][value="Pay"], button:has-text("Pay")').first().click();
    await sim.waitForLoadState("domcontentloaded");
    await shot(sim, `${name}-simulator-paid`);
  } finally {
    await ctx.close();
  }
  expect(leaked, "header bypass tidak boleh terkirim ke Midtrans").toEqual([]);
}

const payVa = (browser: Browser, bankPath: string, va: string, name: string) =>
  simulatorPay(browser, bankPath, (p) => p.locator('input[type="text"]').first().fill(va), name);

async function expectPaidOnce(
  page: Page,
  code: string,
  slug: string,
  before: { collected: bigint; donors: number },
) {
  const p = await waitStatus(code, "paid");
  expect(p.trxStatus).toBe("paid");
  await page.waitForURL(new RegExp(`/transaksi/${code}/berhasil`), { timeout: 60_000 });
  await expect(page.getByTestId("payment-success")).toBeVisible();
  const after = await campaignTotals(slug);
  expect(after.collected - before.collected).toBe(p.amount);
  expect(after.donors - before.donors).toBe(1);
  const events = await eventSnippet(p.id);
  expect(
    events.filter((e) => e.event_type === "notification" && e.result === "processed"),
  ).toHaveLength(1);
  note("events", JSON.stringify(events));
  return p;
}

let paidOrder: { orderId: string; slug: string } | undefined;

test("@sandbox 1. open amount → QRIS (fallback Permata VA bila QRIS nonaktif) → simulator → berhasil, total +1", async ({
  page,
  browser,
}) => {
  const qrisActive = await isMethodActive("qris");
  if (!qrisActive) {
    const probe = await probeChannel({ payment_type: "qris", qris: { acquirer: "gopay" } });
    note(
      "BLOCKED",
      `QRIS: payment_methods nonaktif; charge sandbox → ${probe.statusCode} ${probe.message}`,
    );
  }
  const before = await campaignTotals(OPEN_SLUG);
  const { code } = await checkout(page, OPEN_SLUG, "12345");
  await pay(page, code, qrisActive ? /QRIS/ : /Permata Virtual Account/);
  await shot(page, "s1-instruksi");
  const p = (await payments(code)).at(-1)!;
  note("trx", `${code} payment ${p.id} ${p.method}`);
  if (qrisActive) {
    await simulatorPay(
      browser,
      "/v2/qris/index",
      (s) =>
        s
          .locator('input[type="text"]')
          .first()
          .fill(p.instruction.qrString ?? ""),
      "s1",
    );
  } else {
    await payVa(browser, "/openapi/va/index?bank=permata", p.instruction.vaNumber!, "s1");
  }
  await expectPaidOnce(page, code, OPEN_SLUG, before);
  await shot(page, "s1-berhasil");
});

test("@sandbox 2. fixed amount → BCA VA → simulator → berhasil, total +1", async ({
  page,
  browser,
}) => {
  const before = await campaignTotals(FIXED_SLUG);
  const { code } = await checkout(page, FIXED_SLUG);
  await pay(page, code, /BCA Virtual Account/);
  await expect(page.getByTestId("va-number")).toBeVisible();
  await shot(page, "s2-instruksi");
  const p = (await payments(code)).at(-1)!;
  note("trx", `${code} payment ${p.id} ${p.method}`);
  await payVa(browser, "/bca/va/index", p.instruction.vaNumber!, "s2");
  await expectPaidOnce(page, code, FIXED_SLUG, before);
  await shot(page, "s2-berhasil");
  paidOrder = { orderId: p.id, slug: FIXED_SLUG };
});

test("@sandbox 3. Mandiri Bill → simulator → berhasil, total +1", async ({ page, browser }) => {
  const before = await campaignTotals(OPEN_SLUG);
  const { code } = await checkout(page, OPEN_SLUG, "20000");
  await pay(page, code, /Mandiri Bill/);
  await expect(page.getByTestId("bill-key")).toBeVisible();
  await shot(page, "s3-instruksi");
  const p = (await payments(code)).at(-1)!;
  note("trx", `${code} payment ${p.id} ${p.method}`);
  await simulatorPay(
    browser,
    "/openapi/va/index?bank=mandiri",
    async (s) => {
      await s.locator("#billerCode").fill(p.instruction.billerCode!);
      await s.locator("#billKey").fill(p.instruction.billKey!);
      await s.locator("#billKey").dispatchEvent("change");
    },
    "s3",
  );
  await expectPaidOnce(page, code, OPEN_SLUG, before);
  await shot(page, "s3-berhasil");
});

test("@sandbox 4. GoPay deeplink → pending + status via simulator", async ({ page, browser }) => {
  if (!(await isMethodActive("gopay"))) {
    const probe = await probeChannel({ payment_type: "gopay" });
    note(
      "BLOCKED",
      `GoPay: payment_methods nonaktif; charge sandbox → ${probe.statusCode} ${probe.message}`,
    );
    // Bukti perilaku terdokumentasi (§3a #8): kanal belum aktif → 402/404, bukan pending.
    expect(["402", "404"]).toContain(probe.statusCode);
    return;
  }
  const before = await campaignTotals(OPEN_SLUG);
  const { code } = await checkout(page, OPEN_SLUG, "11000");
  await pay(page, code, /GoPay/);
  const p = await waitStatus(code, "pending", 10_000);
  note("trx", `${code} payment ${p.id} ${p.method}`);
  expect(p.instruction.paymentUrl ?? "").toMatch(/^(https|gojek):\/\//);
  await shot(page, "s4-instruksi");
  await simulatorPay(
    browser,
    "/v2/deeplink/index",
    (s) => s.locator('input[type="text"]').first().fill(p.instruction.paymentUrl!),
    "s4",
  );
  await expectPaidOnce(page, code, OPEN_SLUG, before);
});

test("@sandbox 5. VA dibiarkan → job expire-payments (signature QStash) → kedaluwarsa", async ({
  page,
  request,
}) => {
  const { code } = await checkout(page, OPEN_SLUG, "13000");
  await pay(page, code, /BNI Virtual Account/);
  const p = (await payments(code)).at(-1)!;
  note("trx", `${code} payment ${p.id} ${p.method}`);
  expect(p.status).toBe("pending");
  // Uji: geser expires_at ke masa lalu (baris uji saja), status tetap pending sampai job memutuskan.
  await backdateExpiry(p.id);

  const path = "/api/jobs/expire-payments";
  // Bila run terjadwal memegang lock → `skipped`; ulangi sampai payment kita diproses.
  await expect
    .poll(
      async () => {
        const body = "{}";
        const res = await request.post(`${BASE}${path}`, {
          data: body,
          headers: {
            "content-type": "application/json",
            "upstash-signature": signQStash(`${BASE}${path}`, body),
          },
        });
        expect(res.status()).toBe(200);
        return (await payments(code)).at(-1)!.status;
      },
      { timeout: 120_000, intervals: [5000] },
    )
    .toBe("expired");

  const after = (await payments(code)).at(-1)!;
  expect(after.trxStatus).toBe("expired");
  expect((await midtransStatus(p.id)).transaction_status).toBe("expire");
  note("events", JSON.stringify(await eventSnippet(p.id)));
  await page.reload();
  await expect(page.getByTestId("payment-expired")).toBeVisible();
  await shot(page, "s5-kedaluwarsa");

  // Tanpa signature → 401 (fail-closed).
  const unsigned = await request.post(`${BASE}${path}`, {
    data: "{}",
    headers: { "content-type": "application/json" },
  });
  expect(unsigned.status()).toBe(401);
});

test("@sandbox 6. ganti metode di tengah jalan → payment lama cancelled & di-expire di Midtrans", async ({
  page,
}) => {
  const { code, payUrl } = await checkout(page, OPEN_SLUG, "14000");
  await pay(page, code, /BCA Virtual Account/);
  await page.goto(payUrl);
  await pay(page, code, /BNI Virtual Account/);
  const [oldP, newP] = await payments(code);
  note("trx", `${code} lama ${oldP!.id} ${oldP!.method} → baru ${newP!.id} ${newP!.method}`);
  expect(oldP!.status).toBe("cancelled");
  expect(newP!.status).toBe("pending");
  expect(newP!.trxStatus).toBe("pending");
  expect((await midtransStatus(oldP!.id)).transaction_status).toBe("expire");
  note("events-old", JSON.stringify(await eventSnippet(oldP!.id)));
  await shot(page, "s6-instruksi-metode-baru");
});

test("@sandbox 7. notifikasi yang sama dikirim ulang 2× → duplicate, total tidak berubah", async ({
  request,
}) => {
  expect(paidOrder, "butuh order paid dari skenario 2").toBeDefined();
  const { orderId, slug } = paidOrder!;
  const before = await campaignTotals(slug);
  const body = await signedNotification(orderId);
  for (let i = 0; i < 2; i++) {
    const res = await request.post(`${BASE}/api/webhooks/midtrans`, {
      data: body,
      headers: { "content-type": "application/json" },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).result).toBe("duplicate");
  }
  expect(await campaignTotals(slug)).toEqual(before);
  const events = await eventSnippet(orderId);
  expect(
    events.filter((e) => e.result === "processed" && e.event_type === "notification"),
  ).toHaveLength(1);
  expect(events.filter((e) => e.result === "duplicate").length).toBeGreaterThanOrEqual(2);
  note("events", JSON.stringify(events));
});
