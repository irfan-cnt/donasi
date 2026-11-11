import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./helpers/fixtures";
import { ADMIN_COOKIE, cleanupAdmin, seedAdmin, seedAdminSession, type SeededAdmin } from "./helpers/admin-session";
import { cleanupCheckout, markSeededPaid, seedTransaction } from "./helpers/checkout-data";
import { SESSION_COOKIE, cleanupDonorSession, seedDonorSession, type SeededDonorSession } from "./helpers/donor-session";

// P26 (testing-plan non-fungsional): axe WCAG 2.1 A/AA di halaman publik & alur donasi.
// Pelanggaran `serious`/`critical` = gagal; `moderate`/`minor` dicatat di laporan (JSON di
// test-results/axe/) tanpa menggagalkan test.
const OPEN = "contoh-beasiswa-santri-penghafal-quran";
const FIXED = "contoh-paket-sembako-dhuafa";
const OUT = "test-results/axe";

const emails: string[] = [];
let admin: SeededAdmin | undefined;
let donor: SeededDonorSession | undefined;
test.afterAll(async () => {
  await cleanupCheckout(emails);
  if (admin) await cleanupAdmin(admin);
  if (donor) await cleanupDonorSession(donor);
});

async function audit(page: Page, name: string, project: string) {
  await page.waitForLoadState("networkidle");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${project}-${name}.json`, JSON.stringify(summary, null, 2));
  const blocking = summary.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, `axe serious/critical di ${name}`).toEqual([]);
}

const PAGES: [string, string][] = [
  ["home", "/"],
  ["listing", "/campaign"],
  ["campaign-detail", `/campaign/${OPEN}`],
  ["news-list", `/campaign/${OPEN}/berita`],
  ["checkout-open", `/donasi/${OPEN}`],
  ["checkout-fixed", `/donasi/${FIXED}`],
  ["masuk", "/masuk"],
  ["admin-masuk", "/admin/masuk"],
  ["not-found", "/campaign/tidak-ada-p26"],
];

for (const [name, path] of PAGES) {
  test(`axe: ${name} tanpa pelanggaran serious/critical`, async ({ page }, info) => {
    await page.goto(path);
    await audit(page, name, info.project.name);
  });
}

const newEmail = () => {
  const email = `e2e+axe-${randomUUID()}@example.test`;
  emails.push(email);
  return email;
};

test("axe: instruksi pembayaran tanpa pelanggaran serious/critical", async ({ page }, info) => {
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending" });
  await page.goto(`/transaksi/${t.code}/instruksi?t=${t.token}`);
  await audit(page, "instruksi", info.project.name);
});

test("axe: menunggu pembayaran tanpa pelanggaran serious/critical", async ({ page }, info) => {
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending" });
  await page.goto(`/transaksi/${t.code}/menunggu?t=${t.token}`);
  await audit(page, "menunggu", info.project.name);
});

test("axe: berhasil tanpa pelanggaran serious/critical", async ({ page }, info) => {
  const t = await seedTransaction({ slug: OPEN, email: newEmail(), status: "pending" });
  await markSeededPaid(t.transactionId, t.paymentId);
  await page.goto(`/transaksi/${t.code}/berhasil?t=${t.token}`);
  await audit(page, "berhasil", info.project.name);
});

for (const [name, path] of [
  ["akun", "/akun"],
  ["akun-donasi", "/akun/donasi"],
  ["akun-profil", "/akun/profil"],
] as const) {
  test(`axe: donatur ${name} tanpa pelanggaran serious/critical`, async ({ page, baseURL }, info) => {
    donor ??= await seedDonorSession();
    await page.context().addCookies([{ name: SESSION_COOKIE, value: donor.sessionToken, url: baseURL! }]);
    await page.goto(path);
    await audit(page, name, info.project.name);
  });
}

for (const [name, path] of [
  ["admin-dashboard", "/admin"],
  ["admin-transaksi", "/admin/transaksi"],
  ["admin-campaign-baru", "/admin/campaign/baru"],
] as const) {
  test(`axe: ${name} tanpa pelanggaran serious/critical`, async ({ page, baseURL }, info) => {
    admin ??= await seedAdmin({ role: "owner", totpEnabled: true });
    const token = await seedAdminSession(admin.id);
    await page.context().addCookies([{ name: ADMIN_COOKIE, value: token, url: baseURL! }]);
    await page.goto(path);
    await audit(page, name, info.project.name);
  });
}
