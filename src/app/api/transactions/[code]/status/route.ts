import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/redis";
import { transactionStatusQuery, transactionStatusResponse } from "@/lib/validation/transaction-status";
import { getTransactionStatus } from "@/server/services/payment-service";

// Polling status transaksi (P12, AC-08.1). Hanya MEMBACA DB: tidak memanggil Midtrans dan tidak
// mengubah status (BR-18). Token salah/kedaluwarsa → 404 (tidak membocorkan keberadaan kode).
// URL memuat access token → jangan pernah me-log URL/query (logger juga meredaksi ?t=).

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer" };
/** Polling 5 s = 12/menit per tab; 30/menit per IP+kode memberi ruang beberapa tab. */
const RATE = { limit: 30, window: "1 m" } as const;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return forwarded && isIP(forwarded) ? forwarded : "unknown";
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/transactions/[code]/status">) {
  const { code } = await ctx.params;
  const parsed = transactionStatusQuery.safeParse({ code, t: request.nextUrl.searchParams.get("t") ?? "" });
  if (!parsed.success) return json({ error: "not_found" }, 404);

  try {
    const rl = await rateLimit("trx-status", `${clientIp(request)}:${parsed.data.code}`, RATE.limit, RATE.window);
    if (!rl.success) {
      const retry = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
      return json({ error: "rate_limited" }, 429, { "Retry-After": String(retry) });
    }
  } catch (error) {
    // OD-15: fail-open (endpoint read-only, token 256-bit).
    logger.warn("rate limit status transaksi tidak tersedia; fail-open", { error: String(error) });
  }

  try {
    const result = await getTransactionStatus(parsed.data.code, parsed.data.t);
    if (!result) return json({ error: "not_found" }, 404);
    return json(transactionStatusResponse.parse(result));
  } catch (error) {
    logger.error("status transaksi gagal", { error: error instanceof Error ? error.name : "unknown" });
    return json({ error: "error" }, 500);
  }
}
