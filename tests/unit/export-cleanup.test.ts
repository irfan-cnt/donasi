/**
 * P22 M1 — pembersihan berkas ekspor: BlobExportStore menelusuri SEMUA halaman listing
 * (cursor/hasMore), cleanupExportFiles memakai retensi 2 jam dan tidak melempar.
 * @vercel/blob di-mock: tidak ada panggilan jaringan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => ({
  pages: [] as { blobs: { url: string; uploadedAt: Date }[]; hasMore: boolean; cursor?: string }[],
  listCalls: [] as (string | undefined)[],
  deleted: [] as string[],
}));
vi.mock("@vercel/blob", () => ({
  list: async (o: { cursor?: string }) => {
    blob.listCalls.push(o.cursor);
    const i = o.cursor ? Number(o.cursor) : 0;
    return blob.pages[i];
  },
  del: async (urls: string[]) => {
    blob.deleted.push(...urls);
  },
  put: async () => ({}),
  get: async () => null,
  head: async () => ({}),
}));

import { createLogger } from "@/lib/logger";
import { BlobExportStore, type ExportStore } from "@/lib/storage/export-storage";
import { cleanupExportFiles, EXPORT_FILE_RETENTION_MS } from "@/server/services/admin-export-service";

const now = Date.UTC(2026, 10, 11, 12, 0, 0);
const old = new Date(now - 3 * 3_600_000);
const fresh = new Date(now - 10 * 60_000);

describe("pembersihan berkas ekspor (M1)", () => {
  beforeEach(() => {
    blob.listCalls = [];
    blob.deleted = [];
  });

  it("menelusuri semua halaman listing dan hanya menghapus yang lewat retensi", async () => {
    blob.pages = [
      { blobs: [{ url: "a-old", uploadedAt: old }, { url: "a-new", uploadedAt: fresh }], hasMore: true, cursor: "1" },
      { blobs: [{ url: "b-old", uploadedAt: old }], hasMore: true, cursor: "2" },
      { blobs: [{ url: "c-old", uploadedAt: old }], hasMore: false },
    ];
    const n = await new BlobExportStore("tok").deleteOlderThan("exports/", new Date(now - EXPORT_FILE_RETENTION_MS));
    expect(blob.listCalls).toEqual([undefined, "1", "2"]);
    expect(blob.deleted).toEqual(["a-old", "b-old", "c-old"]);
    expect(n).toBe(3);
  });

  it("retensi ±2 jam; tanpa store dilewati; error tidak dilempar", async () => {
    expect(EXPORT_FILE_RETENTION_MS).toBe(2 * 3_600_000);
    const log = createLogger({ test: "cleanup" });
    expect(await cleanupExportFiles(null, log, now)).toEqual({ exportFilesRemoved: 0, exportCleanup: "skipped" });
    let cutoff: Date | null = null;
    const store: ExportStore = {
      put: async () => undefined,
      get: async () => null,
      exists: async () => false,
      deleteOlderThan: async (_p, d) => {
        cutoff = d;
        return 4;
      },
    };
    expect(await cleanupExportFiles(store, log, now)).toEqual({ exportFilesRemoved: 4, exportCleanup: "ok" });
    expect(cutoff!.getTime()).toBe(now - 2 * 3_600_000);
    const broken: ExportStore = { ...store, deleteOlderThan: async () => Promise.reject(new Error("boom")) };
    expect(await cleanupExportFiles(broken, log, now)).toEqual({ exportFilesRemoved: 0, exportCleanup: "error" });
  });
});
