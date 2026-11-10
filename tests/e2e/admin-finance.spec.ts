import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_COOKIE, cleanupAdmin, seedAdmin, seedAdminSession, type SeededAdmin } from "./helpers/admin-session";

// P22 — admin keuangan end-to-end (Neon dev): otorisasi per role, masking PII, detail transaksi
// tanpa "tandai lunas", ekspor CSV sesuai filter, kredensial tidak pernah ke browser, responsif.
// Data uji ber-prefix e2e-p22 dan dihapus di afterAll. Screenshot ke P22_SCREENSHOT_DIR (opsional).
const SHOT_DIR = process.env.P22_SCREENSHOT_DIR;
const RUN = randomUUID().slice(0, 8);
const seeded: SeededAdmin[] = [];
const campaignId = randomUUID();
const donorId = randomUUID();
const txId = randomUUID();
const email = `e2e-p22+${RUN}@example.test`;
const phone = `+62813${String(Date.now()).slice(-8)}`;
const code = `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").slice(0, 6)}`;

function db() {
  if (process.env.NEON_BRANCH !== "dev") throw new Error("E2E hanya untuk NEON_BRANCH=dev");
  return neon(process.env.DATABASE_URL!);
}

test.beforeAll(async () => {
  const sql = db();
  const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
  await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
    values (${campaignId}, ${cat!.id}, ${`Campaign e2e-p22 ${RUN}`}, ${`e2e-p22-${RUN}`}, 'uji', '<p>uji</p>')`;
  await sql`insert into donors (id, email, name, phone_e164) values (${donorId}, ${email}, ${`Donatur E2E P22 ${RUN}`}, ${phone})`;
  await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount, status,
      campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, donor_phone_snapshot)
    values (${txId}, ${code}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${donorId}, 125000, 'expired',
      ${`Campaign e2e-p22 ${RUN}`}, ${`Donatur E2E P22 ${RUN}`}, ${email}, ${phone})`;
});

test.afterAll(async () => {
  const sql = db();
  await sql`delete from audit_logs where entity_id = ${txId}`.catch(() => undefined);
  await sql`delete from transactions where id = ${txId}`;
  await sql`delete from donors where id = ${donorId}`;
  await sql`delete from campaigns where id = ${campaignId}`;
  while (seeded.length) await cleanupAdmin(seeded.pop()!);
});

async function loginAs(page: Page, baseURL: string | undefined, role: "owner" | "admin" | "finance" | "editor") {
  const admin = await seedAdmin({ role, totpEnabled: true, name: `Uji P22 ${role}` });
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
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const h1 = (page: Page) => page.getByRole("heading", { level: 1 }).filter({ visible: true });

test.describe("admin keuangan (P22)", () => {
  test("editor: semua halaman keuangan ditolak; API ekspor 403", async ({ page, baseURL }) => {
    await loginAs(page, baseURL, "editor");
    for (const path of ["/admin/transaksi", `/admin/transaksi/${txId}`, "/admin/donatur", "/admin/metode-pembayaran", "/admin/log-pembayaran", "/admin/audit"]) {
      await page.goto(path);
      await expect(h1(page)).toHaveText("Akses ditolak");
    }
    const res = await page.request.post("/api/admin/exports", { data: { kind: "transactions", filters: {} }, headers: { origin: new URL(baseURL!).origin } });
    expect(res.status()).toBe(403);
  });

  test("tanpa sesi: API ekspor 401", async ({ request, baseURL }) => {
    const res = await request.post("/api/admin/exports", { data: { kind: "transactions", filters: {} }, headers: { origin: new URL(baseURL!).origin } });
    expect(res.status()).toBe(401);
  });

  test("admin: PII dimasking, tidak ada tandai lunas, metode pembayaran ditolak", async ({ page, baseURL }) => {
    const errors = trackErrors(page);
    await loginAs(page, baseURL, "admin");
    await page.goto(`/admin/transaksi/${txId}`);
    await expect(h1(page)).toHaveText(code);
    await expect(page.getByTestId("donor-email").filter({ visible: true })).not.toHaveText(email);
    const html = await page.content();
    expect(html).not.toContain(email);
    expect(html).not.toContain(phone);
    await expect(page.getByRole("button", { name: /tandai lunas/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cek status ke Midtrans" }).filter({ visible: true })).toBeVisible();
    // Pencarian parsial email tidak menjadi oracle; nilai persis tetap bisa dicari.
    await page.goto(`/admin/transaksi?q=${encodeURIComponent(email.slice(0, 14) + "@")}`);
    await expect(page.getByText("Tidak ada transaksi").filter({ visible: true })).toBeVisible();
    await page.goto(`/admin/transaksi?q=${encodeURIComponent(email)}`);
    await expect(page.getByText(code).filter({ visible: true }).first()).toBeVisible();
    await page.goto("/admin/metode-pembayaran");
    await expect(h1(page)).toHaveText("Akses ditolak");
    expect(errors.filter((e) => !/403|Forbidden/i.test(e))).toEqual([]);
  });

  test("finance: PII penuh, ekspor CSV sesuai filter, metode tanpa kredensial, responsif", async ({ page, baseURL }, info) => {
    const errors = trackErrors(page);
    await loginAs(page, baseURL, "finance");

    await page.goto(`/admin/donatur?q=${encodeURIComponent(email)}&id=${donorId}`);
    await expect(page.getByTestId("donor-detail")).toContainText(email);

    await page.goto(`/admin/transaksi?campaign=${campaignId}&status=expired`);
    await expect(page.getByText(code).filter({ visible: true }).first()).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Ekspor CSV" }).click()]);
    const csv = await readFile((await download.path())!, "utf8");
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(csv).toContain(code);
    expect(csv).toContain(email);

    await page.goto("/admin/metode-pembayaran");
    await expect(h1(page)).toHaveText("Metode Pembayaran");
    await expect(page.getByTestId("provider-card")).toBeVisible();
    const html = await page.content();
    for (const secret of [process.env.MIDTRANS_SERVER_KEY, process.env.MIDTRANS_CLIENT_KEY]) {
      if (secret) expect(html).not.toContain(secret);
    }
    await expect(page.getByTestId("method-editor")).toBeVisible();

    const pages = ["/admin/transaksi", `/admin/transaksi/${txId}`, `/admin/donatur?id=${donorId}`, "/admin/metode-pembayaran", "/admin/log-pembayaran", "/admin/audit"];
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of pages) {
        await page.goto(path);
        await expect(h1(page)).toBeVisible();
        expect(await noOverflow(page), `${path} @${width}`).toBe(true);
        if (SHOT_DIR && info.project.name === "desktop") {
          const name = path.replace(/\?.*$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").replace(txId, "detail");
          await page.screenshot({ path: `${SHOT_DIR}/${name}-${width}.png`, fullPage: true });
        }
      }
    }
    expect(errors).toEqual([]);
  });
});
