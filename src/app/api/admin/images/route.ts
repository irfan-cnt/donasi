import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestMeta, requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { writeAudit } from "@/lib/audit";
import { ImageValidationError, MAX_IMAGE_BYTES, processImageUpload } from "@/lib/images/process-image";
import { BodyTooLargeError, readCapped } from "@/lib/http/read-capped";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import { getImageStorage } from "@/lib/storage/image-storage";
import { siteUrl } from "@/lib/site";

// Upload gambar campaign/berita/logo metode (OD-12): server-side, sesi admin + permission
// campaigns.write, news.write, atau payment_methods.write, cek Origin (cookie SameSite=Strict sebagai lapis pertama), magic bytes,
// maks 2 MB, re-encode WebP. Token Blob tidak pernah ke browser.

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Overhead multipart (boundary + header part) di atas batas berkas. */
const MULTIPART_OVERHEAD = 16 * 1024;
const MAX_BODY = MAX_IMAGE_BYTES + MULTIPART_OVERHEAD;

/** L1: hanya origin kanonik situs (APP_URL), tidak memercayai header Host/X-Forwarded-Host. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(siteUrl()).origin;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ctx = await requireAdmin();
  // P22: logo metode pembayaran juga diunggah lewat route ini (payment_methods.write).
  if (!(["campaigns.write", "news.write", "payment_methods.write"] as const).some((p) => hasPermission(ctx.permissions, p))) {
    return json(403, { error: "Anda tidak punya izin mengunggah gambar." });
  }
  if (!sameOrigin(req)) return json(403, { error: "Permintaan ditolak." });
  // H2: content-length wajib & numerik; batas juga ditegakkan pada stream (header bisa bohong).
  const rawLength = req.headers.get("content-length");
  if (!rawLength || !/^\d{1,10}$/.test(rawLength)) return json(411, { error: "Unggahan tidak valid." });
  if (Number(rawLength) > MAX_BODY) return json(413, { error: "Ukuran gambar maksimal 2 MB." });
  const limit = await rateLimit("admin-image-upload", ctx.adminId, 30, "10 m");
  if (!limit.success) return json(429, { error: "Terlalu banyak unggahan. Coba lagi beberapa menit lagi." });

  let file: File | null = null;
  try {
    const body = await readCapped(req.body, MAX_BODY);
    const form = await new Response(new Uint8Array(body), {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json(413, { error: "Ukuran gambar maksimal 2 MB." });
    return json(400, { error: "Unggahan tidak valid." });
  }
  if (!file) return json(400, { error: "Pilih berkas gambar." });
  if (file.size > MAX_IMAGE_BYTES) return json(413, { error: "Ukuran gambar maksimal 2 MB." });

  try {
    const image = await processImageUpload(Buffer.from(await file.arrayBuffer()));
    const key = `images/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.webp`;
    const stored = await getImageStorage().put(key, image.data, image.contentType);
    const meta = await getRequestMeta();
    await writeAudit({
      actor: { type: "admin", id: ctx.adminId },
      action: "image.upload",
      entityType: "image",
      entityId: stored.url.slice(0, 300),
      after: { url: stored.url, width: image.width, height: image.height, bytes: image.data.length },
      ip: meta.ip,
      ua: meta.ua,
    });
    return json(201, { url: stored.url, width: image.width, height: image.height });
  } catch (error) {
    if (error instanceof ImageValidationError) return json(422, { error: error.message });
    logger.error("upload gambar gagal", { error: String(error) });
    return json(500, { error: "Gagal mengunggah gambar. Silakan coba lagi." });
  }
}
