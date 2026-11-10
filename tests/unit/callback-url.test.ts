import { describe, expect, it } from "vitest";
import { DEFAULT_DONOR_CALLBACK, sanitizeCallbackUrl } from "@/lib/auth/callback-url";

describe("sanitizeCallbackUrl", () => {
  it.each([
    ["/akun", "/akun"],
    ["/akun/transaksi?page=2", "/akun/transaksi?page=2"],
    ["/campaign/sedekah-air#donasi", "/campaign/sedekah-air#donasi"],
    ["  /akun  ", "/akun"],
  ])("menerima path internal %s", (input, expected) => {
    expect(sanitizeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/akun",
    "http://localhost:3000/akun",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/akun\\..\\//evil.example",
    "javascript:alert(1)",
    "data:text/html,hi",
    "akun",
    "",
    "   ",
    "/\tevil",
    "/masuk",
    "/masuk?callbackUrl=/akun",
    "/api/auth/signout",
    "/" + "a".repeat(3000),
  ])("menolak %s", (input) => {
    expect(sanitizeCallbackUrl(input)).toBe(DEFAULT_DONOR_CALLBACK);
  });

  it("menolak non-string dan memakai fallback kustom", () => {
    expect(sanitizeCallbackUrl(undefined)).toBe(DEFAULT_DONOR_CALLBACK);
    expect(sanitizeCallbackUrl(["/akun"])).toBe(DEFAULT_DONOR_CALLBACK);
    expect(sanitizeCallbackUrl(null, "/")).toBe("/");
  });

  it("tidak mengizinkan path yang menormalisasi ke host lain", () => {
    expect(sanitizeCallbackUrl("/.///evil.example")).not.toMatch(/^\/\//);
  });
});
