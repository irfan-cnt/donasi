import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "./helpers/fixtures";
import { ADMIN_COOKIE, cleanupAdmin, seedAdmin, seedAdminSession, type SeededAdmin } from "./helpers/admin-session";

// P23 — admin template & log notifikasi end-to-end (Neon dev). Server WAJIB dijalankan dengan
// NOTIFICATIONS_ENABLED=false WHATSAPP_ENABLED=false QSTASH_TOKEN="" (tidak ada email/WA/QStash
// sungguhan): kirim tes → `skipped`, kirim ulang → "gagal diantrekan". Template seed hanya dilihat,
// tidak pernah disimpan. Data uji ber-prefix e2e-p23 dan dihapus di afterAll.
const SHOT_DIR = process.env.P23_SCREENSHOT_DIR;
const RUN = randomUUID().slice(0, 8);
const seeded: SeededAdmin[] = [];
const campaignId = randomUUID();
const donorId = randomUUID();
const txId = randomUUID();
const failedLogId = randomUUID();
const paidLogId = randomUUID();
const email = `e2e-p23+${RUN}@example.test`;
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
    values (${campaignId}, ${cat!.id}, ${`Campaign e2e-p23 ${RUN}`}, ${`e2e-p23-${RUN}`}, 'uji', '<p>uji</p>')`;
  await sql`insert into donors (id, email, name, phone_e164) values (${donorId}, ${email}, ${`Donatur E2E P23 ${RUN}`}, ${phone})`;
  await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount, status,
      campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, donor_phone_snapshot, paid_at)
    values (${txId}, ${code}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${donorId}, 125000, 'paid',
      ${`Campaign e2e-p23 ${RUN}`}, ${`Donatur E2E P23 ${RUN}`}, ${email}, ${phone}, now())`;
  await sql`insert into notification_logs (id, channel, recipient, event, transaction_id, dedup_key, status, attempt, error_message, provider_response)
    values (${failedLogId}, 'email', ${email}, 'payment.failed', ${txId}, ${`payment.failed:${txId}:${randomUUID()}:email`}, 'failed', 3,
      ${`EAUTH:535 untuk ${email}`}, ${JSON.stringify({ response: `535 rejected ${email}`, token: "rahasia-e2e" })}::jsonb)`;
  await sql`insert into notification_logs (id, channel, recipient, event, transaction_id, dedup_key, status, attempt, sent_at, provider_response)
    values (${paidLogId}, 'email', ${email}, 'payment.paid', ${txId}, ${`payment.paid:${txId}:email`}, 'sent', 1, now(),
      ${JSON.stringify({ messageId: "<e2e@test>", accepted: 1, rejected: 0, response: "250 OK" })}::jsonb)`;
});

test.afterAll(async () => {
  const sql = db();
  const admins = seeded.map((a) => a.email);
  await sql`delete from notification_logs where transaction_id = ${txId} or (is_test and recipient = any(${admins}))`;
  await sql`delete from audit_logs where entity_id = ${txId}`.catch(() => undefined);
  await sql`delete from transactions where id = ${txId}`;
  await sql`delete from donors where id = ${donorId}`;
  await sql`delete from campaigns where id = ${campaignId}`;
  while (seeded.length) await cleanupAdmin(seeded.pop()!);
});

async function loginAs(page: Page, baseURL: string | undefined, role: "owner" | "admin" | "finance" | "editor") {
  const admin = await seedAdmin({ role, totpEnabled: true, name: `Uji P23 ${role}` });
  seeded.push(admin);
  const token = await seedAdminSession(admin.id);
  await page.context().addCookies([{ name: ADMIN_COOKIE, value: token, url: baseURL ?? "http://localhost:3100" }]);
  return admin;
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

test.describe("admin notifikasi (P23)", () => {
  for (const role of ["editor", "finance"] as const) {
    test(`${role}: halaman notifikasi ditolak & tidak ada di menu`, async ({ page, baseURL }) => {
      await loginAs(page, baseURL, role);
      for (const path of ["/admin/template-notifikasi", "/admin/log-notifikasi"]) {
        await page.goto(path);
        await expect(h1(page)).toHaveText("Akses ditolak");
      }
      await page.goto("/admin");
      await expect(page.locator('a[href="/admin/template-notifikasi"]')).toHaveCount(0);
      await expect(page.locator('a[href="/admin/log-notifikasi"]')).toHaveCount(0);
    });
  }

  test("admin: template — variabel ilegal ditolak, pratinjau sandbox, kirim tes hanya ke admin", async ({ page, baseURL }) => {
    const errors = trackErrors(page);
    const admin = await loginAs(page, baseURL, "admin");
    await page.goto("/admin/template-notifikasi");
    await expect(h1(page)).toHaveText("Template Notifikasi");
    await page.getByTestId("template-list").getByRole("link", { name: /Pembayaran berhasil/ }).first().click();
    await expect(page).toHaveURL(/id=/);
    const preview = page.getByTestId("email-preview");
    await expect(preview).toHaveAttribute("sandbox", "");
    await expect(page.frameLocator('[data-testid="email-preview"]').locator("body")).toContainText("Ahmad Fauzi");

    const body = page.getByLabel("Isi pesan");
    await body.fill(`${await body.inputValue()} {{donor_ktp}}`);
    await expect(page.getByText(/Variabel tidak dikenal: donor_ktp/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Simpan versi baru" })).toBeDisabled();
    await page.getByRole("button", { name: "Batal" }).click();

    await expect(page.getByLabel("Tujuan kirim tes")).toHaveValue(admin.email);
    await page.getByRole("button", { name: "Kirim tes" }).click();
    await expect(page.getByText(/NOTIFICATIONS_ENABLED=false/)).toBeVisible();
    const [log] = await db()`select recipient, is_test, transaction_id from notification_logs where is_test and recipient = ${admin.email}`;
    expect(log).toMatchObject({ recipient: admin.email, is_test: true, transaction_id: null });

    await page.goto("/admin/template-notifikasi?kanal=whatsapp");
    await expect(page.getByTestId("wa-preview")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim tes" })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test("admin (tanpa donors.export): log dimasking, respons ter-redaksi, kirim ulang paksa tercatat", async ({ page, baseURL }) => {
    const errors = trackErrors(page);
    const admin = await loginAs(page, baseURL, "admin");
    await page.goto(`/admin/log-notifikasi?q=${encodeURIComponent(code)}&id=${failedLogId}`);
    await expect(h1(page)).toHaveText("Log Notifikasi");
    await expect(page.getByTestId("notification-rows").locator("li")).toHaveCount(2);
    const html = await page.content();
    expect(html).not.toContain(email);
    expect(html).not.toContain("rahasia-e2e");
    await expect(page.getByTestId("provider-response")).toContainText("[REDACTED]");
    // Pencarian penerima parsial bukan oracle; nilai persis cocok.
    await page.goto(`/admin/log-notifikasi?q=${encodeURIComponent(email.slice(0, 14) + "@")}`);
    await expect(page.getByText("Belum ada notifikasi").filter({ visible: true })).toBeVisible();
    await page.goto(`/admin/log-notifikasi?q=${encodeURIComponent(email)}`);
    await expect(page.getByTestId("notification-rows").locator("li")).toHaveCount(2);

    // payment.paid sudah terkirim → butuh kirim ulang paksa dengan alasan.
    await page.goto(`/admin/log-notifikasi?q=${encodeURIComponent(code)}&id=${paidLogId}`);
    const detail = page.getByTestId("notification-detail");
    await detail.getByRole("button", { name: "Kirim ulang", exact: true }).click();
    await expect(detail.getByText(/sudah terkirim/)).toBeVisible();
    const confirm = detail.getByRole("button", { name: "Konfirmasi kirim ulang paksa" });
    await expect(confirm).toBeDisabled();
    await detail.getByLabel("Alasan").fill("Donatur melapor email konfirmasi tidak masuk");
    await detail.getByRole("checkbox").check();
    await confirm.click();
    // Server e2e tanpa QSTASH_TOKEN → baris baru tercatat lalu gagal diantrekan (tidak ada kirim langsung).
    await expect(detail.getByText(/gagal diantrekan/)).toBeVisible();
    const rows = await db()`select status, error_message from notification_logs where dedup_key like ${`resend:${paidLogId}:%`}
      and id::text in (select entity_id from audit_logs where actor_id = ${admin.id})`;
    expect(rows).toEqual([{ status: "failed", error_message: "gagal diantrekan (QStash)" }]);
    const audits = await db()`select action from audit_logs where actor_id = ${admin.id} and action like 'notification.resend%'`;
    expect(audits.map((a) => a.action)).toEqual(["notification.resend_forced"]);
    expect(errors).toEqual([]);
  });

  test("owner: penerima penuh, responsif 360/768/1280", async ({ page, baseURL }, info) => {
    const errors = trackErrors(page);
    await loginAs(page, baseURL, "owner");
    await page.goto(`/admin/log-notifikasi?q=${encodeURIComponent(code)}&id=${failedLogId}`);
    await expect(page.getByTestId("notification-detail")).toContainText(email);
    // Respons provider tetap dimasking untuk semua admin.
    await expect(page.getByTestId("provider-response")).not.toContainText(email);

    const pages = ["/admin/template-notifikasi", "/admin/template-notifikasi?kanal=whatsapp", `/admin/log-notifikasi?q=${encodeURIComponent(code)}&id=${failedLogId}`];
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of pages) {
        await page.goto(path);
        await expect(h1(page)).toBeVisible();
        expect(await noOverflow(page), `${path} @${width}`).toBe(true);
        if (SHOT_DIR && info.project.name === "desktop") {
          const name = path.replace(/\?kanal=whatsapp/, "-wa").replace(/\?.*$/, "").replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "");
          await page.screenshot({ path: `${SHOT_DIR}/${name}-${width}.png`, fullPage: true });
        }
      }
    }
    expect(errors).toEqual([]);
  });
});
