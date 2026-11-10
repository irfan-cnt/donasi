import "server-only";
import sharp from "sharp";

// Upload gambar campaign/berita (OD-12, security.md §2): validasi magic bytes (bukan ekstensi
// atau Content-Type dari client), maks 2 MB, lalu re-encode ke WebP (metadata EXIF/GPS dibuang).

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_WIDTH = 1600;
const MAX_INPUT_PIXELS = 40_000_000;

export type DetectedImage = "jpeg" | "png" | "webp";

export class ImageValidationError extends Error {}

/** Deteksi tipe dari magic bytes. null = bukan JPEG/PNG/WebP. */
export function detectImageType(buf: Uint8Array): DetectedImage | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 8 && png.every((b, i) => buf[i] === b)) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.subarray(from, to));
  if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
}

export async function processImageUpload(buf: Buffer): Promise<ProcessedImage> {
  if (buf.length === 0) throw new ImageValidationError("Berkas kosong.");
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageValidationError("Ukuran gambar maksimal 2 MB.");
  if (!detectImageType(buf)) throw new ImageValidationError("Format harus JPG, PNG, atau WebP.");
  try {
    const { data, info } = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, contentType: "image/webp" };
  } catch {
    throw new ImageValidationError("Gambar rusak atau tidak dapat diproses.");
  }
}
