import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { getEnv } from "@/lib/env";
import { blobStoreHost } from "./blob-host";

// Penyimpanan gambar (OD-12 = Vercel Blob). Interface agar test memakai fake in-memory dan
// development tanpa BLOB_READ_WRITE_TOKEN memakai disk lokal (public/uploads/dev, di-gitignore).

export interface StoredImage {
  url: string;
}

export interface ImageStorage {
  readonly kind: "blob" | "local" | "memory";
  put(key: string, data: Buffer, contentType: string): Promise<StoredImage>;
}

export class BlobImageStorage implements ImageStorage {
  readonly kind = "blob";
  constructor(private readonly token: string) {}
  async put(key: string, data: Buffer, contentType: string): Promise<StoredImage> {
    const res = await put(key, data, {
      access: "public",
      contentType,
      token: this.token,
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
    });
    return { url: res.url };
  }
}

/** Hanya APP_ENV=development. Disajikan oleh /api/dev-uploads/[file] (juga saat `next start`). */
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "dev");
export const LOCAL_UPLOAD_PREFIX = "/api/dev-uploads/";

export class LocalImageStorage implements ImageStorage {
  readonly kind = "local";
  async put(key: string, data: Buffer): Promise<StoredImage> {
    const name = key.replace(/\//g, "-");
    await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_UPLOAD_DIR, name), data);
    return { url: `${LOCAL_UPLOAD_PREFIX}${name}` };
  }
}

let override: ImageStorage | null = null;

/** KHUSUS TEST. */
export function setImageStorageForTests(storage: ImageStorage | null): void {
  override = storage;
}

export function getImageStorage(): ImageStorage {
  if (override) return override;
  const env = getEnv();
  if (env.BLOB_READ_WRITE_TOKEN) return new BlobImageStorage(env.BLOB_READ_WRITE_TOKEN);
  if (env.APP_ENV === "development") return new LocalImageStorage();
  throw new Error("Env BLOB_READ_WRITE_TOKEN belum diisi");
}

const LOCAL_FILE = /^\/api\/dev-uploads\/[a-z0-9-]+\.webp$/;

/**
 * URL gambar yang boleh disimpan di campaign/berita: hasil upload storage aplikasi (Blob/lokal)
 * atau gambar bawaan seed yang sudah tersimpan. Mencegah admin menyisipkan URL eksternal sembarang.
 */
export function isManagedImageUrl(url: string, allowed: readonly string[] = []): boolean {
  if (allowed.includes(url)) return true;
  if (LOCAL_FILE.test(url)) return getEnv().APP_ENV === "development" || override !== null;
  try {
    const u = new URL(url);
    // Hanya host store Blob milik proyek ini (kesamaan persis), bukan wildcard *.public.blob….
    const host = blobStoreHost(getEnv());
    return host !== null && u.protocol === "https:" && u.hostname === host && !u.port && !u.username && !u.password;
  } catch {
    return false;
  }
}
