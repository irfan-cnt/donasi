import { expect, test, type Page } from "@playwright/test";
import { authenticator } from "otplib";
import {
  ADMIN_COOKIE,
  ADMIN_PASSWORD,
  auditActions,
  cleanupAdmin,
  getAdminRow,
  seedAdmin,
  seedAdminSession,
  type SeededAdmin,
} from "./helpers/admin-session";
import { SESSION_COOKIE, cleanupDonorSession, seedDonorSession } from "./helpers/donor-session";

const seeded: SeededAdmin[] = [];

test.afterEach(async () => {
  while (seeded.length) await cleanupAdmin(seeded.pop()!);
});

async function newAdmin(opts: Parameters<typeof seedAdmin>[0]) {
  const admin = await seedAdmin(opts);
  seeded.push(admin);
  return admin;
}

async function login(page: Page, email: string, password: string, totp = "") {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  if (totp) await page.getByLabel("Kode autentikator (6 digit)").fill(totp);
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function setCookie(page: Page, baseURL: string | undefined, name: string, value: string) {
  await page.context().addCookies([{ name, value, url: baseURL ?? "http://localhost:3100" }]);
}

test.describe("auth admin (P05)", () => {
  test("/admin/masuk tampil tanpa error konsol", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/admin/masuk");
    await expect(page.getByRole("heading", { name: "Masuk sebagai admin" })).toBeVisible();
    await expect(page.getByLabel("Kode autentikator (6 digit)")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("tanpa sesi, /admin → /admin/masuk", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/masuk$/);
  });

  test("sesi donor tidak memberi akses /admin (AC-10.3)", async ({ page, baseURL }) => {
    const donor = await seedDonorSession();
    try {
      await setCookie(page, baseURL, SESSION_COOKIE, donor.sessionToken);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/masuk$/);
      // Token donor yang dipasang sebagai cookie admin pun ditolak server.
      await setCookie(page, baseURL, ADMIN_COOKIE, donor.sessionToken);
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/admin\/masuk$/);
    } finally {
      await cleanupDonorSession(donor);
    }
  });

  test("sesi admin tidak memberi akses /akun donatur", async ({ page, baseURL }) => {
    const admin = await newAdmin({ role: "owner" });
    await setCookie(page, baseURL, ADMIN_COOKIE, await seedAdminSession(admin.id));
    await page.goto("/akun");
    await expect(page).toHaveURL(/\/masuk\?callbackUrl=%2Fakun$/);
  });

  test("sesi idle > 30 menit ditolak", async ({ page, baseURL }) => {
    const admin = await newAdmin({ role: "admin" });
    await setCookie(page, baseURL, ADMIN_COOKIE, await seedAdminSession(admin.id, 31));
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/masuk$/);
  });

  test("sesi aktif valid membuka dashboard", async ({ page, baseURL }) => {
    const admin = await newAdmin({ role: "admin" });
    await setCookie(page, baseURL, ADMIN_COOKIE, await seedAdminSession(admin.id, 5));
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  });

  test("role editor ditolak akses transaksi → 403 (AC-22.2)", async ({ page, baseURL }) => {
    const editor = await newAdmin({ role: "editor" });
    await setCookie(page, baseURL, ADMIN_COOKIE, await seedAdminSession(editor.id));
    await page.goto("/admin/transaksi");
    // forbidden(): UI 403. Status HTTP tetap 200 karena shell PPR sudah di-stream
    // (cacheComponents) — konten transaksi tidak pernah dirender.
    await expect(page.getByRole("heading", { name: "Akses ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Transaksi" })).toHaveCount(0);

    const finance = await newAdmin({ role: "finance" });
    await setCookie(page, baseURL, ADMIN_COOKIE, await seedAdminSession(finance.id));
    await page.goto("/admin/transaksi");
    await expect(page.getByRole("heading", { name: "Transaksi" })).toBeVisible();
  });

  test("5 password salah → akun terkunci 15 menit (AC-22.1)", async ({ page }) => {
    const admin = await newAdmin({ role: "editor" });
    await page.goto("/admin/masuk");
    for (let i = 1; i <= 4; i++) {
      await login(page, admin.email, `salah-${i}`);
      await expect.poll(async () => (await getAdminRow(admin.id)).failed_login_count).toBe(i);
      await expect(page.getByText("Email, password, atau kode autentikator salah.")).toBeVisible();
      // React mereset form setelah action selesai; tunggu agar isian berikutnya tidak terhapus.
      await expect(page.getByLabel("Email")).toHaveValue("");
    }
    await login(page, admin.email, "salah-5");
    await expect.poll(async () => (await getAdminRow(admin.id)).locked_until).not.toBeNull();
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByText("Akun dikunci sementara").first()).toBeVisible();

    const row = await getAdminRow(admin.id);
    expect(row.locked_until).not.toBeNull();
    const minutes = (new Date(row.locked_until!).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    // Percobaan ke-6 dengan password BENAR tetap ditolak.
    await login(page, admin.email, ADMIN_PASSWORD);
    await expect(page.getByText("Akun dikunci sementara").first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/masuk$/);
    expect(await auditActions(admin.id)).toContain("admin.lockout");
  });

  test("login pertama owner: ganti password → setup TOTP → dashboard", async ({ page }) => {
    const owner = await newAdmin({ role: "owner", mustChangePassword: true });
    await page.goto("/admin/masuk");
    await login(page, owner.email, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/admin\/ganti-password$/);

    // Sebelum selesai, halaman panel tetap dialihkan ke langkah wajib.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/ganti-password$/);

    const newPassword = "Password-Baru-E2E-456";
    await page.getByLabel("Password saat ini").fill(ADMIN_PASSWORD);
    await page.getByLabel("Password baru (min. 12 karakter)").fill(newPassword);
    await page.getByLabel("Ulangi password baru").fill(newPassword);
    await page.getByRole("button", { name: "Simpan password" }).click();
    await expect(page).toHaveURL(/\/admin\/setup-totp$/);
    await expect(page.getByAltText("Kode QR untuk aplikasi autentikator")).toBeVisible();

    const row = await getAdminRow(owner.id);
    expect(row.must_change_password).toBe(false);
    expect(row.totp_secret_enc).toMatch(/^v1\./); // terenkripsi, bukan base32 mentah

    await page.getByText("Tidak bisa memindai? Masukkan kunci manual").click();
    const secret = (await page.locator("details code").textContent())!.trim();
    await page.getByLabel("Kode dari aplikasi (6 digit)").fill(authenticator.generate(secret));
    await page.getByRole("button", { name: "Aktifkan autentikator" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

    // Keluar lalu masuk lagi: kini TOTP wajib.
    await page.getByRole("button", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/admin\/masuk$/);
    await login(page, owner.email, newPassword);
    await expect(page.getByText("Email, password, atau kode autentikator salah.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("");
    await login(page, owner.email, newPassword, authenticator.generate(secret));
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

    expect(await auditActions(owner.id)).toEqual(
      expect.arrayContaining([
        "admin.login",
        "admin.password_change",
        "admin.totp_enable",
        "admin.login_failed",
      ]),
    );
  });
});
