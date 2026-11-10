import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { LOCAL_UPLOAD_DIR } from "@/lib/storage/image-storage";

// Menyajikan upload adapter lokal (HANYA APP_ENV=development, tanpa BLOB_READ_WRITE_TOKEN).
// Lewat route agar file yang ditulis setelah `next build` tetap tersaji saat `next start`.
export async function GET(_req: Request, ctx: RouteContext<"/api/dev-uploads/[file]">) {
  if (getEnv().APP_ENV !== "development") return new Response(null, { status: 404 });
  const { file } = await ctx.params;
  if (!/^[a-z0-9-]+\.webp$/.test(file)) return new Response(null, { status: 404 });
  try {
    const data = await readFile(path.join(LOCAL_UPLOAD_DIR, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
