import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test, type Page } from "./helpers/fixtures";
import sharp from "sharp";
import { ADMIN_COOKIE, cleanupAdmin, seedAdmin, seedAdminSession, type SeededAdmin } from "./helpers/admin-session";

// P21 — admin campaign & berita end-to-end dengan sesi admin seed (Neon dev) dan adapter
// upload lokal (development tanpa BLOB_READ_WRITE_TOKEN). Campaign uji ber-prefix e2e-p21-.
const SHOT_DIR = process.env.P21_SCREENSHOT_DIR;
const RUN = randomUUID().slice(0, 8);
const seeded: SeededAdmin[] = [];
const uploaded: string[] = [];

function db() {
  if (process.env.NEON_BRANCH !== "dev") throw new Error("E2E hanya untuk NEON_BRANCH=dev");
  return neon(process.env.DATABASE_URL!);
}

test.afterAll(async () => {
  const sql = db();
  const ids = (await sql`select id from campaigns where slug like ${`e2e-p21-${RUN}%`}`).map((r) => r.id as string);
  for (const id of ids) {
    await sql`delete from campaign_news where campaign_id = ${id}`;
    await sql`delete from campaigns where id = ${id}`;
    await sql`delete from audit_logs where entity_id = ${id}`.catch(() => undefined);
  }
  while (seeded.length) await cleanupAdmin(seeded.pop()!);
  for (const url of uploaded) {
    const name = url.split("/").pop()!;
    if (/^[a-z0-9-]+\.webp$/.test(name)) await unlink(path.join("public", "uploads", "dev", name)).catch(() => undefined);
  }
});

async function loginAs(page: Page, baseURL: string | undefined, role: "owner" | "editor") {
  const admin = await seedAdmin({ role, totpEnabled: true, name: `Uji P21 ${role}` });
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
  return errors;
}

// Next 16 (cacheComponents) menyimpan rute sebelumnya sebagai <Activity> tersembunyi → filter yang terlihat.
const vis = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });

const lbl = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const pngFile = async (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: await sharp({ create: { width: 1200, height: 750, channels: 3, background: "#2f855a" } }).png().toBuffer(),
});

test.describe("admin campaign & berita (P21)", () => {
  test("owner: draft → edit → upload gambar → terbitkan → tampil publik; berita terbit", async ({ page, baseURL }, info) => {
    const errors = trackErrors(page);
    await loginAs(page, baseURL, "owner");
    const slug = `e2e-p21-${RUN}-${info.project.name}-${randomUUID().slice(0, 6)}`;
    const title = `Campaign E2E P21 ${slug.slice(8)}`;

    await page.goto("/admin/campaign/baru");
    await expect(page.getByRole("heading", { name: "Campaign Baru" })).toBeVisible();
    await lbl(page, "Judul").fill(title);
    await lbl(page, "Slug").fill(slug);
    await lbl(page, "Kategori").selectOption({ index: 1 });
    await lbl(page, "Deskripsi singkat").fill("Ringkasan campaign uji end-to-end.");
    await page.getByRole("button", { name: "Simpan Draf" }).click();
    await expect(page).toHaveURL(/\/admin\/campaign\/[0-9a-f-]{36}/);
    await expect(vis(page, "campaign-status")).toHaveText("Draf");

    await page.waitForLoadState("networkidle");
    // Edit: deskripsi rich text + upload gambar utama (adapter lokal) + alt.
    const editor = page.locator("#c-desc").filter({ visible: true });
    await editor.click();
    await page.keyboard.type("Deskripsi lengkap campaign uji.");
    const upload = page.waitForResponse((r) => r.url().includes("/api/admin/images") && r.request().method() === "POST");
    await vis(page, "upload-featured").setInputFiles(await pngFile("utama.png"));
    const res = await upload;
    expect(res.status()).toBe(201);
    const { url } = (await res.json()) as { url: string };
    uploaded.push(url);
    expect(url).toMatch(/^\/api\/dev-uploads\/[a-z0-9-]+\.webp$/);
    await lbl(page, "Teks alternatif gambar utama").fill("Anak-anak menerima bantuan");

    // Pratinjau draft tersedia.
    await expect(page.getByRole("link", { name: "Pratinjau draft" })).toHaveAttribute("href", new RegExp(`/campaign/${slug}/pratinjau\\?token=`));

    await page.getByRole("button", { name: "Simpan & Terbitkan" }).click();
    await expect(vis(page, "editor-message")).toContainText("diterbitkan");
    await expect(vis(page, "campaign-status")).toHaveText("Tayang");

    await page.goto(`/campaign/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Deskripsi lengkap campaign uji.").first()).toBeVisible();

    // Berita: tulis → terbitkan.
    await page.goto("/admin/berita?tulis=1");
    const panel = vis(page, "news-editor");
    await panel.getByLabel("Campaign").selectOption({ label: title });
    await panel.getByLabel("Judul", { exact: true }).fill("Kabar penyaluran perdana");
    await panel.locator("#n-content").click();
    await page.keyboard.type("Alhamdulillah bantuan sudah disalurkan.");
    await panel.getByRole("button", { name: "Terbitkan" }).click();
    await expect(page).toHaveURL(/edit=/);
    await expect(vis(page, "news-rows")).toContainText("Kabar penyaluran perdana");
    await expect(vis(page, "news-rows")).toContainText("Terbit");
    await page.goto(`/campaign/${slug}/berita/kabar-penyaluran-perdana`);
    await expect(page.getByRole("heading", { level: 1, name: "Kabar penyaluran perdana" })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("editor: bisa simpan draf tetapi tidak ada tombol terbitkan", async ({ page, baseURL }, info) => {
    const errors = trackErrors(page);
    await loginAs(page, baseURL, "editor");
    await page.goto("/admin/campaign/baru");
    await lbl(page, "Judul").fill(`Campaign Editor P21 ${RUN}`);
    await lbl(page, "Slug").fill(`e2e-p21-${RUN}-editor-${info.project.name}-${randomUUID().slice(0, 6)}`);
    await lbl(page, "Kategori").selectOption({ index: 1 });
    await expect(page.getByRole("button", { name: "Simpan & Terbitkan" })).toHaveCount(0);
    await page.getByRole("button", { name: "Simpan Draf" }).click();
    await expect(page).toHaveURL(/\/admin\/campaign\/[0-9a-f-]{36}/);
    await expect(page.getByRole("button", { name: "Arsipkan campaign" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("upload palsu (teks berekstensi .jpg) ditolak", async ({ page, baseURL }) => {
    await loginAs(page, baseURL, "owner");
    await page.goto("/admin/campaign/baru");
    await page.waitForLoadState("networkidle"); // tunggu hidrasi sebelum memilih berkas
    const res = page.waitForResponse((r) => r.url().includes("/api/admin/images"));
    await vis(page, "upload-featured").setInputFiles({ name: "palsu.jpg", mimeType: "image/jpeg", buffer: Buffer.from("bukan gambar") });
    expect((await res).status()).toBe(422);
    await expect(page.getByText("Format harus JPG, PNG, atau WebP.")).toBeVisible();
  });

  test("daftar & editor responsif 360/1280 tanpa overflow & error konsol", async ({ page, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "viewport diatur manual; cukup sekali");
    const errors = trackErrors(page);
    await loginAs(page, baseURL, "owner");
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/campaign");
      await expect(page.getByRole("heading", { name: "Campaign", exact: true })).toBeVisible();
      expect(await noOverflow(page), `list overflow di ${width}px`).toBe(true);
      if (SHOT_DIR && width !== 768) await page.screenshot({ path: `${SHOT_DIR}/campaign-list-${width}.png`, fullPage: true });

      await page.goto("/admin/campaign?status=published");
      // Spec lain (paralel, DB dev bersama) membuat & menghapus campaign terbit: bila campaign yang
      // dipilih keburu dihapus, ambil ulang dari daftar. Asersi akhirnya tetap sama.
      const heading = page.getByRole("heading", { name: "Edit Campaign" });
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await page.goto("/admin/campaign?status=published");
        const first = page.locator(width >= 768 ? "[data-testid=campaign-table] a" : "[data-testid=campaign-rows-mobile] a").filter({ visible: true }).first();
        await page.goto((await first.getAttribute("href"))!);
        if (await heading.isVisible().catch(() => false)) break;
        await heading.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
        if (await heading.isVisible().catch(() => false)) break;
      }
      await expect(heading).toBeVisible();
      await expect(page.locator("#c-desc").filter({ visible: true })).toBeVisible();
      expect(await noOverflow(page), `editor overflow di ${width}px`).toBe(true);
      if (SHOT_DIR && width !== 768) await page.screenshot({ path: `${SHOT_DIR}/campaign-editor-${width}.png`, fullPage: true });

      await page.goto("/admin/berita");
      expect(await noOverflow(page), `berita overflow di ${width}px`).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});
