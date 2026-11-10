import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { requestLogger } from "@/lib/logger";
import { getProvider } from "@/lib/payments/registry";
import { rateLimit } from "@/lib/redis";
import {
  handleMidtransWebhook,
  MAX_WEBHOOK_BODY_BYTES,
} from "@/lib/payments/webhook/midtrans-webhook";
import {
  publishPaidNotification,
  revalidateCampaignThrottled,
} from "@/lib/payments/webhook/side-effects";
import { publishNotification } from "@/server/services/notifications/publish";

// HTTP Notification Midtrans (P13, F-17). Kode respons: payment-architecture.md §5b.
// Jangan pernah me-log body/header (signature_key, PII).
// Runtime Node.js: default route handler; `export const runtime` tidak kompatibel dengan
// cacheComponents (Next 16) sehingga tidak dideklarasikan.

const HEADERS = { "Cache-Control": "no-store" };
const reply = (status: number, result: string) =>
  NextResponse.json({ ok: status < 300, result }, { status, headers: HEADERS });

/** Signature ditolak per IP: 20/menit, lalu 429 (Midtrans asli tidak pernah ditolak). */
const REJECT_RATE = { limit: 20, window: "1 m" } as const;

function clientIp(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");
  return forwarded && isIP(forwarded) ? forwarded : "unknown";
}

/** Baca body dengan batas byte (tidak mempercayai Content-Length saja). */
async function readLimited(request: NextRequest, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: NextRequest) {
  const log = requestLogger(request.headers.get("x-request-id")).child({
    route: "webhook.midtrans",
  });
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") return reply(415, "unsupported_media_type");

  let rawBody: string | null;
  try {
    rawBody = await readLimited(request, MAX_WEBHOOK_BODY_BYTES);
  } catch {
    return reply(400, "unreadable_body");
  }
  if (rawBody === null) return reply(413, "payload_too_large");

  try {
    const out = await handleMidtransWebhook(
      { headers: request.headers, rawBody },
      {
        provider: getProvider("midtrans"),
        publishPaid: publishPaidNotification,
        revalidateCampaign: revalidateCampaignThrottled,
        publishNotification,
        onRejectedSignature: async () => {
          try {
            const rl = await rateLimit(
              "webhook-reject",
              clientIp(request),
              REJECT_RATE.limit,
              REJECT_RATE.window,
            );
            return !rl.success;
          } catch (error) {
            log.warn("rate limit webhook tidak tersedia; fail-open", { error: String(error) });
            return false;
          }
        },
        log,
      },
    );
    return reply(out.status, out.body.result);
  } catch (error) {
    log.error("webhook midtrans: error tak terduga", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return reply(503, "retry");
  }
}
