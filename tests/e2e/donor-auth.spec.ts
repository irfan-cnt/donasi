import { expect, test } from "@playwright/test";
import {
  SESSION_COOKIE,
  cleanupDonorSession,
  donorExistsForUser,
  seedDonorSession,
  sessionExists,
  type SeededDonorSession,
} from "./helpers/donor-session";

test.describe("login donatur (P04)", () => {
  let seed: SeededDonorSession | undefined;

  test.afterEach(async () => {
    if (seed) await cleanupDonorSession(seed);
    seed = undefined;
  });

  test("halaman /masuk tampil tanpa error konsol", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/masuk");
    await expect(page.getByRole("heading", { name: "Masuk ke akunmu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lanjutkan dengan Google" })).toBeVisible();
    await expect(page.getByText("Gagal masuk")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("state error tampil saat ?error=", async ({ page }) => {
    await page.goto("/masuk?error=AccessDenied");
    await expect(page.getByRole("alert").filter({ hasText: "Gagal masuk" })).toBeVisible();
  });

  test("callbackUrl eksternal diabaikan (AC-09.3)", async ({ page }) => {
    await page.goto("/masuk?callbackUrl=https%3A%2F%2Fevil.example");
    await expect(page.locator('input[name="callbackUrl"]')).toHaveValue("/akun");
  });

  test("akses /akun tanpa sesi → /masuk?callbackUrl=/akun (AC-10.1)", async ({ page }) => {
    await page.goto("/akun");
    await expect(page).toHaveURL(/\/masuk\?callbackUrl=%2Fakun$/);
  });

  test("cookie sesi palsu ditolak di server", async ({ page, context, baseURL }) => {
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: "bukan-sesi-valid",
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/akun");
    await expect(page).toHaveURL(/\/masuk\?callbackUrl=%2Fakun$/);
  });

  test("sesi valid membuka /akun, logout menghapus sesi DB (AC-10.2)", async ({
    page,
    context,
    baseURL,
  }) => {
    seed = await seedDonorSession();
    const cookie = {
      name: SESSION_COOKIE,
      value: seed.sessionToken,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Lax" as const,
    };
    await context.addCookies([cookie]);

    await page.goto("/akun");
    await expect(page.getByRole("heading", { name: /Donatur E2E/ })).toBeVisible();
    expect(await donorExistsForUser(seed.userId)).toBe(true);

    // Sudah login → /masuk mengarahkan ke callbackUrl.
    await page.goto("/masuk");
    await expect(page).toHaveURL(/\/akun$/);

    await page.getByRole("button", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => sessionExists(seed!.sessionToken)).toBe(false);

    // Cookie lama tidak bisa dipakai lagi.
    await context.addCookies([cookie]);
    await page.goto("/akun");
    await expect(page).toHaveURL(/\/masuk\?callbackUrl=%2Fakun$/);
  });
});
