/**
 * P22 — unit: CSV aman (formula injection), masking PII, token unduh ekspor, validasi filter &
 * input metode, redaksi payload event, matriks permission halaman/menu, dan pemindaian statis
 * bahwa tidak ada endpoint/action yang menulis status `paid` di luar applyVerifiedStatus.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";
import { ADMIN_NAV, navForPermissions } from "@/lib/admin-auth/admin-nav";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { csvCell, csvRow } from "@/lib/csv";
import { signExportToken, verifyExportToken } from "@/lib/exports/export-token";
import { maskEmail, maskPhone } from "@/lib/format/mask";
import {
  auditQuery,
  donorListQuery,
  paymentEventQuery,
  paymentMethodInputSchema,
  reorderSchema,
  transactionListQuery,
} from "@/lib/validation/admin-finance";
import { phoneQuery } from "@/server/repositories/admin-finance-repository";

const SECRET = "x".repeat(40);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("CSV", () => {
  it("menetralkan formula injection (= + - @ TAB CR)", () => {
    for (const bad of ["=HYPERLINK(\"x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      const cell = csvCell(bad);
      expect(cell.replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(csvCell("Budi")).toBe("Budi");
  });
  it("mengutip koma, kutip, dan baris baru; bigint & null aman", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(150000n)).toBe("150000");
    expect(csvCell(null)).toBe("");
    expect(csvRow(["a", 1n, null])).toBe("a,1,\r\n");
  });
});

describe("masking PII", () => {
  it("email & WA tidak membocorkan nilai penuh", () => {
    expect(maskEmail("budi.santoso@gmail.com")).toBe("bu***@g***.com");
    expect(maskEmail("a@b.co")).toBe("a***@b***.co");
    expect(maskPhone("+6281234567890")).toBe("+62812****7890");
    expect(maskEmail("budi.santoso@gmail.com")).not.toContain("santoso");
  });
});

describe("token unduh ekspor", () => {
  const now = 1_800_000_000_000;
  const tok = signExportToken({ kind: "transactions", masked: false, exportId: A, adminId: B }, SECRET, now);
  it("roundtrip, terikat admin & jenis", () => {
    expect(verifyExportToken(tok, SECRET, now + 1000)).toMatchObject({ kind: "transactions", masked: false, exportId: A, adminId: B });
  });
  it("kedaluwarsa setelah 1 jam", () => {
    expect(verifyExportToken(tok, SECRET, now + 3_600_000)).toBeNull();
  });
  it("menolak tanda tangan/klaim yang diubah & secret lain", () => {
    expect(verifyExportToken(tok.replace("transactions", "donors"), SECRET, now)).toBeNull();
    expect(verifyExportToken(tok.replace(B, A), SECRET, now)).toBeNull();
    expect(verifyExportToken(tok, "y".repeat(40), now)).toBeNull();
    expect(verifyExportToken("sampah", SECRET, now)).toBeNull();
  });
});

describe("validasi filter", () => {
  it("transaksi: nilai rusak diabaikan, halaman dibatasi", () => {
    const q = transactionListQuery.parse({ status: "lunas", campaign: "bukan-uuid", dari: "2026-13-45", hal: "999999", metode: "x'; drop", q: "  TK-1  " });
    expect(q).toMatchObject({ status: undefined, campaign: undefined, dari: undefined, metode: undefined, hal: 1, q: "TK-1" });
    expect(transactionListQuery.parse({ status: "paid", hal: "3", dari: "2026-11-01" })).toMatchObject({ status: "paid", hal: 3, dari: "2026-11-01" });
  });
  it("donatur, log, audit", () => {
    expect(donorListQuery.parse({ urut: "x", tipe: "akun" })).toMatchObject({ urut: "total", tipe: "akun" });
    expect(paymentEventQuery.parse({ hasil: "processed", tipe: "hack" })).toMatchObject({ hasil: "processed", tipe: undefined });
    expect(auditQuery.parse({ aktor: "system", aksi: "campaign.update" })).toMatchObject({ aktor: "system", aksi: "campaign.update" });
    expect(auditQuery.parse({ aksi: "x;drop" }).aksi).toBeUndefined();
  });
  it("normalisasi nomor WA untuk pencarian", () => {
    expect(phoneQuery("0812-3456-7890")).toBe("+6281234567890");
    expect(phoneQuery("Budi")).toBeNull();
  });
  it("input metode pembayaran", () => {
    const base = { displayName: "BCA VA", logoUrl: null, isActive: true, minAmount: "10000", maxAmount: "", expiryMinutes: 1440, feeFlat: "", feePercent: "0", instructions: [{ title: "ATM", steps: ["Masukkan {{va_number}}"] }] };
    const ok = paymentMethodInputSchema.parse(base);
    expect(ok.minAmount).toBe(10000n);
    expect(ok.maxAmount).toBeNull();
    expect(paymentMethodInputSchema.safeParse({ ...base, maxAmount: "5000" }).success).toBe(false);
    expect(paymentMethodInputSchema.safeParse({ ...base, minAmount: "500" }).success).toBe(false);
    expect(paymentMethodInputSchema.safeParse({ ...base, expiryMinutes: 2 }).success).toBe(false);
    expect(reorderSchema.safeParse([A, A]).success).toBe(false);
  });
});

describe("redaksi payload event", () => {
  it("menyembunyikan signature, token, data kartu & PII", async () => {
    const { redactEventPayload } = await import("@/lib/payments/redact-event");
    const out = JSON.stringify(
      redactEventPayload({ signature_key: "abc", masked_card: "481111-1114", saved_token_id: "t", email: "budi@x.com", va_numbers: [{ bank: "bca", va_number: "123" }], transaction_status: "settlement" }),
    );
    expect(out).not.toContain("abc");
    expect(out).not.toContain("481111");
    expect(out).not.toContain("budi@");
    expect(out).toContain("settlement");
  });
});

// ------------------------------------------------------------- Otorisasi halaman per role
const PAGES: Record<string, string> = {
  "src/app/admin/(panel)/transaksi/page.tsx": "transactions.read",
  "src/app/admin/(panel)/transaksi/[id]/page.tsx": "transactions.read",
  "src/app/admin/(panel)/donatur/page.tsx": "donors.read",
  "src/app/admin/(panel)/metode-pembayaran/page.tsx": "payment_methods.write",
  "src/app/admin/(panel)/log-pembayaran/page.tsx": "transactions.read",
  "src/app/admin/(panel)/audit/page.tsx": "audit.read",
};

describe("otorisasi halaman P22", () => {
  it("setiap halaman memanggil requireAdmin dengan permission yang benar", () => {
    for (const [file, perm] of Object.entries(PAGES)) {
      expect(readFileSync(file, "utf8"), file).toContain(`requireAdmin("${perm}")`);
    }
  });
  it("matriks role BR-40: siapa yang bisa membuka halaman keuangan", () => {
    const can = (role: keyof typeof ROLE_PERMISSIONS, p: Parameters<typeof hasPermission>[1]) => hasPermission(ROLE_PERMISSIONS[role], p);
    expect(can("editor", "transactions.read")).toBe(false);
    expect(can("editor", "donors.read")).toBe(false);
    expect(can("editor", "audit.read")).toBe(false);
    expect(can("admin", "payment_methods.write")).toBe(false);
    expect(can("admin", "donors.export")).toBe(false); // admin melihat PII donatur dimasking
    expect(can("finance", "donors.export")).toBe(true);
    expect(can("finance", "transactions.reconcile")).toBe(true);
    expect(can("owner", "payment_methods.write")).toBe(true);
  });
  it("menu mengikuti permission (editor tidak melihat grup Keuangan)", () => {
    const groups = (role: keyof typeof ROLE_PERMISSIONS) => navForPermissions(ROLE_PERMISSIONS[role]).map((g) => g.title);
    expect(groups("editor")).not.toContain("Keuangan");
    expect(navForPermissions(ROLE_PERMISSIONS.admin).flatMap((g) => g.items.map((i) => i.href))).not.toContain("/admin/metode-pembayaran");
    for (const href of ["/admin/transaksi", "/admin/donatur", "/admin/metode-pembayaran", "/admin/log-pembayaran", "/admin/audit"]) {
      expect(ADMIN_NAV.flatMap((g) => g.items).some((i) => i.href === href)).toBe(true);
    }
  });
  it("action keuangan memakai requireAdmin dengan permission yang benar", () => {
    const src = readFileSync("src/server/actions/admin-finance-actions.ts", "utf8");
    expect(src).toMatch(/savePaymentMethodAction[\s\S]*?requireAdmin\("payment_methods\.write"\)/);
    expect(src).toMatch(/reorderPaymentMethodsAction[\s\S]*?requireAdmin\("payment_methods\.write"\)/);
    expect(src).toMatch(/testProviderConnectionAction[\s\S]*?requireAdmin\("payment_methods\.write"\)/);
    expect(src).toMatch(/checkTransactionStatusAction[\s\S]*?requireAdmin\("transactions\.reconcile"\)/);
  });
});

// ------------------------------------------------------------- Tidak ada jalur "tandai lunas"
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("tidak ada endpoint yang mengubah status ke paid (AC-27.1, BR-18)", () => {
  const files = [...walk("src/app"), ...walk("src/server/actions"), ...walk("src/server/services"), ...walk("src/server/repositories")];
  it("tidak ada penulisan status 'paid' langsung di route/action/service/repository", () => {
    const direct = /(status\s*[:=]\s*["']paid["'][^\n]*\b(set|update)\b)|(\bset\(\s*\{[^}]*status:\s*["']paid["'])|(UPDATE\s+(transactions|payments)\s+SET[^;`]*status\s*=\s*'paid')/i;
    const offenders = files.filter((f) => direct.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("tidak ada aksi/teks 'tandai lunas' / markPaid", () => {
    const offenders = files.filter((f) => /markPaid|mark_paid|markAsPaid|tandaiLunas/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("cek status admin hanya lewat applyProviderStatus dengan source admin_check", () => {
    const src = readFileSync("src/server/services/admin-finance-service.ts", "utf8");
    expect(src).toContain("applyProviderStatus(");
    expect(src).toContain('source: "admin_check"');
    expect(src).toContain("provider.getPaymentStatus(");
  });
});

// ------------------------------------------------------------- Perbaikan review keamanan P22
describe("review keamanan P22", () => {
  it("L2: flag masked terikat HMAC (tidak bisa diubah u↔m)", () => {
    const now = 1_800_000_000_000;
    const m = signExportToken({ kind: "transactions", masked: true, exportId: A, adminId: B }, SECRET, now);
    expect(verifyExportToken(m, SECRET, now)?.masked).toBe(true);
    expect(verifyExportToken(m.replace("transactions.m.", "transactions.u."), SECRET, now)).toBeNull();
  });

  it("L4: formula guard menangkap spasi/baris baru di depan", () => {
    for (const bad of [" =HYPERLINK(\"x\")", "\n=1+1", "  +1", " \t@SUM(A1)", "\r\n-2"]) {
      expect(csvCell(bad).replace(/^"/, "").startsWith("'"), JSON.stringify(bad)).toBe(true);
    }
    expect(csvCell(" Budi ")).toBe('" Budi "');
  });

  it("M2: kata kunci PII tidak disimpan di audit ekspor; render audit menyamarkan PII lama", async () => {
    const { looksLikePii, maskPiiDeep } = await import("@/lib/format/mask");
    const { auditFilterMeta } = await import("@/server/services/admin-export-service");
    expect(looksLikePii("budi@gmail.com")).toBe(true);
    expect(looksLikePii("0812-3456-7890")).toBe(true);
    expect(looksLikePii("+6281234567890")).toBe(true);
    expect(looksLikePii("Budi Santoso")).toBe(false);
    expect(auditFilterMeta({ q: "budi@gmail.com", status: "paid" })).toEqual({ q: "[pii]", status: "paid" });
    expect(auditFilterMeta({ q: "081234567890", urut: "total" })).toEqual({ q: "[pii]", urut: "total" });
    expect(auditFilterMeta({ q: "Budi", urut: "total" })).toEqual({ q: "Budi", urut: "total" });
    const out = JSON.stringify(maskPiiDeep({ filters: { q: "budi.santoso@gmail.com" }, list: ["hubungi 081234567890", "+6281299998888"], n: 5 }));
    expect(out).not.toContain("santoso");
    expect(out).not.toContain("081234567890");
    expect(out).not.toContain("6281299998888");
    expect(out).toContain('"n":5');
  });

  it("M2: halaman audit memasking di server untuk admin tanpa donors.export", () => {
    const src = readFileSync("src/app/admin/(panel)/audit/page.tsx", "utf8");
    expect(src).toContain('hasPermission(ctx.permissions, "donors.export")');
    expect(src).toMatch(/maskPiiDeep\(r\.metadata\)/);
    expect(src).not.toContain('"use client"');
  });

  it("L1: redaksi tampilan event — alamat, VA, kode bayar disembunyikan; email/WA pakai masker yang sama", async () => {
    const { redactEventPayload } = await import("@/lib/payments/redact-event");
    const raw = {
      va_numbers: [{ bank: "bca", va_number: "12345678901" }],
      permata_va_number: "8562000111",
      bill_key: "99887766",
      biller_code: "70012",
      payment_code: "PC123456",
      customer_details: { email: "budi.santoso@gmail.com", phone: "+6281234567890", billing_address: { address: "Jl. Mawar 1", city: "Bandung", postal_code: "40111" } },
      transaction_status: "settlement",
    };
    const out = JSON.stringify(redactEventPayload(raw));
    for (const leak of ["12345678901", "8562000111", "99887766", "70012", "PC123456", "Mawar", "Bandung", "40111", "santoso", "234567"]) {
      expect(out, leak).not.toContain(leak);
    }
    expect(out).toContain("settlement");
    // Display-only: input tidak dimutasi.
    expect(raw.va_numbers[0]!.va_number).toBe("12345678901");
    expect(raw.customer_details.email).toBe("budi.santoso@gmail.com");
  });

  it("L3: log error admin keuangan hanya nama + kode (safeError)", () => {
    for (const f of ["src/server/actions/admin-finance-actions.ts", "src/server/services/admin-finance-service.ts", "src/server/services/admin-export-service.ts", "src/app/api/admin/exports/route.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/String\(error\)|String\(e\)/);
    }
    expect(readFileSync("src/server/actions/admin-finance-actions.ts", "utf8")).toContain("safeError(error)");
  });

  it("L5: batas baris ekspor async diturunkan (berkas disusun di memori)", async () => {
    const { EXPORT_MAX_ROWS } = await import("@/lib/validation/admin-finance");
    expect(EXPORT_MAX_ROWS).toBeLessThanOrEqual(50_000);
  });

  it("M1: cancel-stale terjadwal juga membersihkan berkas ekspor", () => {
    const src = readFileSync("src/app/api/jobs/cancel-stale/route.ts", "utf8");
    expect(src).toContain("cleanupExportFiles(getExportStore(), log)");
  });
});
