import "server-only";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";

// Respons PDF (P19): selalu private, no-store, no-referrer; unduhan sebagai lampiran.
export const PDF_NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

export function pdfResponse(file: { filename: string; body: Buffer }): NextResponse {
  return new NextResponse(new Uint8Array(file.body), {
    status: 200,
    headers: {
      ...PDF_NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.filename.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
      "Content-Length": String(file.body.length),
    },
  });
}

export function pdfError(status: 404 | 429 | 500, extra: Record<string, string> = {}): NextResponse {
  const error = status === 404 ? "not_found" : status === 429 ? "rate_limited" : "error";
  return NextResponse.json({ error }, { status, headers: { ...PDF_NO_STORE, ...extra } });
}

export function clientIp(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return forwarded && isIP(forwarded) ? forwarded : "unknown";
}

/** Render PDF berat → 20/menit per identitas. null = boleh; selain itu respons 429. Fail-open bila Redis mati. */
export async function pdfRateLimit(identifier: string): Promise<NextResponse | null> {
  try {
    const rl = await rateLimit("pdf", identifier, 20, "1 m");
    if (rl.success) return null;
    return pdfError(429, { "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))) });
  } catch (error) {
    logger.warn("rate limit PDF tidak tersedia; fail-open", { error: String(error) });
    return null;
  }
}
