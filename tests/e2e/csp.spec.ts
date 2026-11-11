import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_COOKIE, cleanupAdmin, seedAdmin, seedAdminSession, type SeededAdmin } from "./helpers/admin-session";
import { cleanupCheckout, seedTransaction } from "./helpers/checkout-data";
import { SESSION_COOKIE, cleanupDonorSession, seedDonorSession, type SeededDonorSession } from "./helpers/donor-session";

// P25 (T-45): halaman kunci tidak memicu pelanggaran CSP di browser (script, style, gambar,
// font, iframe pratinjau email, TipTap, Recharts) dan header keamanan terpasang. Data uji dibuat
// di Neon dev dan dihapus di afterAll.
const OPEN = "contoh-beasiswa-santri-penghafal-quran";
const emails: string[] = [];
let admin: SeededAdmin | undefined;
let donor: SeededDonorSession | undefined;

test.afterAll(async () => {
  await cleanupCheckout(emails);
  if (admin) await cleanupAdmin(admin);
  if (donor) await cleanupDonorSession(donor);
});

function watchCsp(page: Page) {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|CSPV/.test(m.text())) violations.push(m.text().slice(0, 300));
  });
  return violations;
}

async function visit(page: Page, path: string, violations: string[]) {
  const res = await page.goto(path);
  await page.waitForLoadState("networkidle");
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(csp, path).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+'/);
  expect(csp, path).not.toContain("unsafe-eval");
  expect(csp, path).toContain("frame-ancestors 'none'");
  expect(res?.headers()["x-frame-options"], path).toBe("DENY");
  expect(res?.headers()["x-content-type-options"], path).toBe("nosniff");
  // Hidrasi berjalan (script framework tidak diblokir).
  await expect.poll(() => page.evaluate(() => Array.isArray((self as unknown as { __next_f?: unknown[] }).__next_f))).toBe(true);
  expect(violations, path).toEqual([]);
  return res;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) =>
      console.error(`CSPV ${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  const octet = () => Math.floor(Math.random() * 254) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${octet()}.${octet()}` });
});

test("publik & checkout tanpa pelanggaran CSP", async ({ page }) => {
  const v = watchCsp(page);
  for (const path of ["/", "/campaign", `/campaign/${OPEN}`, "/masuk", `/donasi/${OPEN}`, "/halaman-tidak-ada-p25"]) {
    await visit(page, path, v);
  }
  // Interaksi klien tetap jalan setelah hidrasi (form checkout).
  await page.goto(`/donasi/${OPEN}`);
  await expect(page.locator("form").first()).toBeVisible();
  expect(v).toEqual([]);
});

test("halaman transaksi ber-token: no-referrer & tanpa pelanggaran CSP", async ({ page }) => {
  const v = watchCsp(page);
  const email = `e2e+p25-csp-${randomUUID()}@example.test`;
  emails.push(email);
  const t = await seedTransaction({ slug: OPEN, email, status: "pending" });
  const res = await visit(page, `/transaksi/${t.code}/instruksi?t=${t.token}`, v);
  expect(res?.headers()["referrer-policy"]).toBe("no-referrer");
});

test("admin (dashboard Recharts, editor TipTap, pratinjau email) tanpa pelanggaran CSP", async ({ page, baseURL }) => {
  admin = await seedAdmin({ role: "owner", totpEnabled: true });
  const token = await seedAdminSession(admin.id);
  await page.context().addCookies([{ name: ADMIN_COOKIE, value: token, url: baseURL ?? "http://localhost:3100" }]);
  const v = watchCsp(page);
  await visit(page, "/admin/masuk", v);
  await visit(page, "/admin", v);
  await visit(page, "/admin/campaign/baru", v);
  await expect(page.locator(".ProseMirror").first()).toBeVisible();
  await visit(page, "/admin/template-notifikasi", v);
  await expect(page.getByTestId("email-preview")).toBeVisible();
  expect(v).toEqual([]);
});

test("donatur (/akun) tanpa pelanggaran CSP", async ({ page, baseURL }) => {
  donor = await seedDonorSession();
  await page.context().addCookies([{ name: SESSION_COOKIE, value: donor.sessionToken, url: baseURL ?? "http://localhost:3100" }]);
  const v = watchCsp(page);
  await visit(page, "/akun", v);
  await visit(page, "/akun/donasi", v);
  await visit(page, "/akun/profil", v);
});

test("API: CSP ketat & header statis", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.headers()["content-security-policy"]).toContain("default-src 'none'");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});
