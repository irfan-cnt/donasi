import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { clientIp, pdfError, pdfRateLimit, pdfResponse } from "@/lib/pdf/http";
import { guestReceiptQuery } from "@/lib/validation/pdf";
import { guestReceiptPdf } from "@/server/services/receipt-service";

// Kuitansi tamu (P19): kode + access token transaksi (?t=, sampai access_token_expires_at).
// Token salah/kedaluwarsa/non-paid → 404. URL memuat token → jangan pernah me-log URL/query.
// Runtime Node.js = default route handler (`export const runtime` tidak kompatibel dengan cacheComponents).

export async function GET(request: NextRequest, ctx: RouteContext<"/api/transactions/[code]/receipt">) {
  const { code } = await ctx.params;
  const parsed = guestReceiptQuery.safeParse({ code, t: request.nextUrl.searchParams.get("t") ?? "" });
  if (!parsed.success) return pdfError(404);
  const limited = await pdfRateLimit(`guest:${clientIp(request)}`);
  if (limited) return limited;
  try {
    const file = await guestReceiptPdf(parsed.data.code, parsed.data.t);
    return file ? pdfResponse(file) : pdfError(404);
  } catch (error) {
    logger.error("PDF kuitansi tamu gagal", { error: error instanceof Error ? error.name : "unknown" });
    return pdfError(500);
  }
}
