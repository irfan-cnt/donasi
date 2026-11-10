import { describe, expect, it } from "vitest";
import { ADMIN_NAV, navForPermissions } from "@/lib/admin-auth/admin-nav";
import { PERMISSION_CODES } from "@/lib/admin-auth/permissions";
import {
  adminSearchSchema,
  classifyAdminSearch,
  previousRange,
  resolveDashboardRange,
} from "@/lib/validation/admin-dashboard";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";

// 11 Nov 2026 00:30 WIB = 10 Nov 2026 17:30 UTC → "hari ini" WIB = 2026-11-11.
const NOW = new Date("2026-11-10T17:30:00Z");

describe("resolveDashboardRange (Asia/Jakarta)", () => {
  it("default 30 hari berakhir di hari ini WIB (bukan UTC)", () => {
    expect(resolveDashboardRange({}, NOW)).toEqual({ from: "2026-10-13", to: "2026-11-11", days: 30, preset: "30" });
  });

  it("preset 7 & 90", () => {
    expect(resolveDashboardRange({ rentang: "7" }, NOW)).toMatchObject({ from: "2026-11-05", to: "2026-11-11", days: 7 });
    expect(resolveDashboardRange({ rentang: "90" }, NOW)).toMatchObject({ from: "2026-08-14", days: 90 });
  });

  it("rentang khusus valid; sampai di masa depan dipotong ke hari ini", () => {
    expect(resolveDashboardRange({ dari: "2026-11-01", sampai: "2026-11-03" }, NOW)).toEqual({
      from: "2026-11-01",
      to: "2026-11-03",
      days: 3,
      preset: "custom",
    });
    expect(resolveDashboardRange({ dari: "2026-11-10", sampai: "2027-01-01" }, NOW)).toMatchObject({
      to: "2026-11-11",
      days: 2,
    });
  });

  it("input tidak valid → default 30 hari", () => {
    for (const raw of [
      { rentang: "365" },
      { dari: "2026-11-05", sampai: "2026-11-01" },
      { dari: "2020-01-01", sampai: "2026-11-01" },
      { dari: "bukan-tanggal", sampai: "2026-11-01" },
      { dari: "2026-02-30", sampai: "2026-03-01" },
      { rentang: ["7", "30"] },
    ]) {
      expect(resolveDashboardRange(raw, NOW).days).toBe(raw.rentang?.[0] === "7" ? 7 : 30);
    }
  });

  it("periode pembanding sama panjang tepat sebelum rentang", () => {
    const r = resolveDashboardRange({ rentang: "7" }, NOW);
    expect(previousRange(r)).toEqual({ from: "2026-10-29", to: "2026-11-04" });
  });
});

describe("pencarian global admin", () => {
  it("klasifikasi query", () => {
    expect(classifyAdminSearch("TK-261111-ABCDEF")).toBe("transaction");
    expect(classifyAdminSearch("tk-2611")).toBe("transaction");
    expect(classifyAdminSearch("budi@contoh.id")).toBe("email");
    expect(classifyAdminSearch("sembako")).toBe("text");
  });

  it("Zod: 2–100 karakter, di-trim", () => {
    expect(adminSearchSchema.safeParse({ q: " a " }).success).toBe(false);
    expect(adminSearchSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(adminSearchSchema.safeParse({ q: 123 }).success).toBe(false);
    expect(adminSearchSchema.parse({ q: "  masjid " }).q).toBe("masjid");
  });
});

describe("menu admin sesuai permission (BR-40)", () => {
  const hrefs = (role: keyof typeof ROLE_PERMISSIONS) =>
    navForPermissions(ROLE_PERMISSIONS[role]).flatMap((g) => g.items.map((i) => i.href));

  it("semua permission menu valid", () => {
    for (const g of ADMIN_NAV) for (const i of g.items) {
      if (i.permission) expect(PERMISSION_CODES).toContain(i.permission);
    }
  });

  it("owner melihat semua menu", () => {
    expect(hrefs("owner")).toHaveLength(ADMIN_NAV.flatMap((g) => g.items).length);
  });

  it("editor hanya dashboard + konten", () => {
    expect(hrefs("editor")).toEqual(["/admin", "/admin/campaign", "/admin/berita"]);
  });

  it("finance: keuangan + audit, tanpa berita/notifikasi", () => {
    const f = hrefs("finance");
    expect(f).toEqual(expect.arrayContaining(["/admin/transaksi", "/admin/donatur", "/admin/metode-pembayaran", "/admin/audit"]));
    expect(f).not.toContain("/admin/berita");
    expect(f).not.toContain("/admin/template-notifikasi");
  });

  it("admin tanpa metode pembayaran", () => {
    expect(hrefs("admin")).not.toContain("/admin/metode-pembayaran");
    expect(hrefs("admin")).toContain("/admin/template-notifikasi");
  });
});
