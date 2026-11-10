/**
 * P22 — route API admin ekspor: 401 tanpa sesi, 403 tanpa permission / admin lain, Origin,
 * dan token unduh. Sesi admin & repository di-mock (tanpa DB); requireAdminApi asli dipakai.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";

const state = vi.hoisted(() => ({ cookie: null as string | null, permissions: [] as string[], adminId: "33333333-3333-4333-8333-333333333333" }));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));
vi.mock("@/server/repositories/admin-repository", () => ({
  findAdminSessionByHash: async () =>
    state.cookie ? { id: "s1", adminUserId: state.adminId, createdAt: new Date(), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000), revokedAt: null } : null,
  findAdminById: async () => ({ id: state.adminId, email: "a@x.test", name: "Uji", status: "active", mustChangePassword: false, totpEnabled: true }),
  loadAdminAccess: async () => ({ roles: ["finance"], permissions: state.permissions }),
  touchAdminSession: async () => undefined,
  insertAdminSession: async () => undefined,
  revokeAdminSessionByHash: async () => undefined,
}));
const startExport = vi.fn();
vi.mock("@/server/services/admin-export-service", async (orig) => ({
  ...(await orig<typeof import("@/server/services/admin-export-service")>()),
  startExport: (...a: unknown[]) => startExport(...a),
  runtimeExportDeps: () => ({ store: null, publish: async () => undefined }),
  exportStatus: async () => "processing",
}));
vi.mock("@/lib/audit", () => ({ writeAudit: async () => undefined }));

import { POST } from "@/app/api/admin/exports/route";
import { GET } from "@/app/api/admin/exports/download/route";
import { getEnv } from "@/lib/env";
import { signExportToken } from "@/lib/exports/export-token";
import { setExportStoreForTests } from "@/lib/storage/export-storage";

// Jangan pernah menyentuh Vercel Blob sungguhan di test.
setExportStoreForTests(null);

const origin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
const post = (body: unknown, o: string | null = origin) =>
  POST(new Request(`${origin}/api/admin/exports`, { method: "POST", body: JSON.stringify(body), headers: o ? { origin: o, "content-type": "application/json" } : {} }));

describe.skipIf(!process.env.AUTH_SECRET)("POST /api/admin/exports", () => {
  beforeEach(() => {
    state.cookie = "tok";
    startExport.mockReset();
    startExport.mockResolvedValue({ mode: "stream", kind: "transactions", rows: 1, stream: new Response("a").body, fileName: "x.csv" });
  });

  it("401 tanpa sesi admin", async () => {
    state.cookie = null;
    expect((await post({ kind: "transactions", filters: {} })).status).toBe(401);
  });
  it("403 editor (tanpa transactions.export) & admin tanpa donors.export untuk ekspor donatur", async () => {
    state.permissions = [...ROLE_PERMISSIONS.editor];
    expect((await post({ kind: "transactions", filters: {} })).status).toBe(403);
    state.permissions = [...ROLE_PERMISSIONS.admin];
    expect((await post({ kind: "donors", filters: {} })).status).toBe(403);
    expect(startExport).not.toHaveBeenCalled();
  });
  it("403 tanpa Origin kanonik", async () => {
    state.permissions = [...ROLE_PERMISSIONS.finance];
    expect((await post({ kind: "transactions", filters: {} }, "https://evil.example")).status).toBe(403);
    expect((await post({ kind: "transactions", filters: {} }, null)).status).toBe(403);
  });
  it("200 CSV untuk finance; filter diteruskan apa adanya ke service", async () => {
    state.permissions = [...ROLE_PERMISSIONS.finance];
    const res = await post({ kind: "transactions", filters: { status: "paid" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(startExport.mock.calls[0]![1]).toEqual({ kind: "transactions", filters: { status: "paid" } });
  });
  it("400 jenis tidak dikenal", async () => {
    state.permissions = [...ROLE_PERMISSIONS.owner];
    expect((await post({ kind: "admins", filters: {} })).status).toBe(400);
  });
});

describe.skipIf(!process.env.AUTH_SECRET)("GET /api/admin/exports/download", () => {
  const exportId = "44444444-4444-4444-8444-444444444444";
  const url = (t: string, cek = false) => new Request(`${origin}/api/admin/exports/download?t=${encodeURIComponent(t)}${cek ? "&cek=1" : ""}`);
  beforeEach(() => {
    state.cookie = "tok";
    state.permissions = [...ROLE_PERMISSIONS.finance];
  });

  it("404 token palsu/kedaluwarsa", async () => {
    expect((await GET(url("palsu"))).status).toBe(404);
    const old = signExportToken({ kind: "transactions", masked: false, exportId, adminId: state.adminId }, getEnv().AUTH_SECRET, Date.now() - 2 * 3_600_000);
    expect((await GET(url(old))).status).toBe(404);
  });
  it("401 tanpa sesi walau token sah; 403 untuk admin lain atau tanpa permission", async () => {
    const tok = signExportToken({ kind: "donors", masked: false, exportId, adminId: state.adminId }, getEnv().AUTH_SECRET);
    state.cookie = null;
    expect((await GET(url(tok))).status).toBe(401);
    state.cookie = "tok";
    state.permissions = [...ROLE_PERMISSIONS.admin]; // tanpa donors.export
    expect((await GET(url(tok))).status).toBe(403);
    state.permissions = [...ROLE_PERMISSIONS.finance];
    const other = signExportToken({ kind: "donors", masked: false, exportId, adminId: "55555555-5555-4555-8555-555555555555" }, getEnv().AUTH_SECRET);
    expect((await GET(url(other))).status).toBe(403);
  });
  it("L2: berkas tanpa masking ditolak bila sesi kini tanpa donors.export; berkas masked tetap boleh", async () => {
    state.permissions = [...ROLE_PERMISSIONS.admin]; // transactions.export tanpa donors.export
    const unmasked = signExportToken({ kind: "transactions", masked: false, exportId, adminId: state.adminId }, getEnv().AUTH_SECRET);
    expect((await GET(url(unmasked))).status).toBe(403);
    const masked = signExportToken({ kind: "transactions", masked: true, exportId, adminId: state.adminId }, getEnv().AUTH_SECRET);
    expect((await GET(url(masked))).status).toBe(409); // lolos otorisasi; berkas belum ada
  });
  it("pemilik: status polling, 409 bila berkas belum ada", async () => {
    const tok = signExportToken({ kind: "donors", masked: false, exportId, adminId: state.adminId }, getEnv().AUTH_SECRET);
    const r = await GET(url(tok, true));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "processing" });
    expect((await GET(url(tok))).status).toBe(409);
  });
});
