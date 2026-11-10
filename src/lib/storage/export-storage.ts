import "server-only";
import { del, get, head, list, put } from "@vercel/blob";
import { getEnv } from "@/lib/env";

// Penyimpanan berkas ekspor CSV async (P22). Berisi PII → Vercel Blob dengan access PRIVATE
// (tidak ada URL publik); berkas hanya disajikan lewat route unduh admin yang memeriksa tanda
// tangan + sesi + permission. Tanpa BLOB_READ_WRITE_TOKEN → null (ekspor besar ditolak dengan
// pesan jelas). Test memakai fake in-memory lewat setExportStoreForTests.

export interface ExportStore {
  put(key: string, data: Buffer): Promise<void>;
  /** Stream isi berkas; null bila belum ada. */
  get(key: string): Promise<ReadableStream<Uint8Array> | null>;
  exists(key: string): Promise<boolean>;
  /** Hapus berkas di bawah `prefix` yang lebih tua dari `olderThan`. */
  deleteOlderThan(prefix: string, olderThan: Date): Promise<number>;
}

export class BlobExportStore implements ExportStore {
  constructor(private readonly token: string) {}
  async put(key: string, data: Buffer): Promise<void> {
    await put(key, data, {
      access: "private",
      contentType: "text/csv; charset=utf-8",
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: data.length > 8 * 1024 * 1024,
    });
  }
  async get(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const r = await get(key, { access: "private", token: this.token, useCache: false }).catch(() => null);
    return r && r.statusCode === 200 ? r.stream : null;
  }
  async exists(key: string): Promise<boolean> {
    return head(key, { token: this.token }).then(
      () => true,
      () => false,
    );
  }
  async deleteOlderThan(prefix: string, olderThan: Date, maxPages = 50): Promise<number> {
    let removed = 0;
    let cursor: string | undefined;
    // Telusuri SEMUA halaman listing (cursor/hasMore), dibatasi maxPages per run.
    for (let page = 0; page < maxPages; page++) {
      const res = await list({ prefix, token: this.token, limit: 1000, cursor });
      const old = res.blobs.filter((b) => b.uploadedAt < olderThan).map((b) => b.url);
      if (old.length) await del(old, { token: this.token });
      removed += old.length;
      if (!res.hasMore || !res.cursor) break;
      cursor = res.cursor;
    }
    return removed;
  }
}

let override: ExportStore | null | undefined;

/** KHUSUS TEST (null = paksa "tidak terkonfigurasi"; undefined = kembali ke env). */
export function setExportStoreForTests(store: ExportStore | null | undefined): void {
  override = store;
}

export function getExportStore(): ExportStore | null {
  if (override !== undefined) return override;
  const token = getEnv().BLOB_READ_WRITE_TOKEN;
  return token ? new BlobExportStore(token) : null;
}

export const exportKey = (kind: string, exportId: string) => `exports/${kind}/${exportId}.csv`;
