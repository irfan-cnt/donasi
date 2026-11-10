import type { NextRequest } from "next/server";
import { requireDonor } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { pdfError, pdfRateLimit, pdfResponse } from "@/lib/pdf/http";
import { donorPdfQuery } from "@/lib/validation/pdf";
import { donorTransactionPdf } from "@/server/services/receipt-service";

// PDF transaksi/kuitansi donor (P19, F-14, AC-14.x). requireDonor + filter donorId (donor lain,
// kode tidak ada, atau kuitansi non-paid → 404). Tanpa sesi → redirect /masuk.
// Runtime Node.js = default route handler (`export const runtime` tidak kompatibel dengan cacheComponents).

export async function GET(request: NextRequest, ctx: RouteContext<"/api/donor/transactions/[code]/pdf">) {
  const { code } = await ctx.params;
  const donor = await requireDonor(`/akun/donasi/${encodeURIComponent(code)}`);
  const parsed = donorPdfQuery.safeParse({ code, type: request.nextUrl.searchParams.get("type") ?? "" });
  if (!parsed.success) return pdfError(404);
  const limited = await pdfRateLimit(`donor:${donor.donorId}`);
  if (limited) return limited;
  try {
    const file = await donorTransactionPdf(donor.donorId, parsed.data.code, parsed.data.type);
    return file ? pdfResponse(file) : pdfError(404);
  } catch (error) {
    logger.error("PDF donor gagal", { type: parsed.data.type, error: error instanceof Error ? error.name : "unknown" });
    return pdfError(500);
  }
}
