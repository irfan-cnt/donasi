import "server-only";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import type { Logger } from "@/lib/logger";
import { publishJob } from "@/lib/qstash";
import { getRedis } from "@/lib/redis";
import { siteUrl } from "@/lib/site";
import { CAMPAIGNS_TAG, campaignTag } from "@/server/queries/public-campaigns";
import type { PaidJob } from "./midtrans-webhook";

// Efek samping webhook setelah commit (P13). Kegagalan di sini tidak pernah mengubah status
// pembayaran; P14 (rekonsiliasi) & P16 (pemindaian audit) menjadi cadangan.

/** Jendela throttle revalidateTag per tag. */
export const REVALIDATE_THROTTLE_SECONDS = 10;

/**
 * Publish payment.paid ke /api/jobs/notify (handler P16). Dedup QStash per transaksi; dedup
 * per kanal (`payment.paid:{trxId}:{channel}`) ditegakkan P16 lewat notification_logs.dedup_key.
 * Tanpa QSTASH_TOKEN hanya di development → log & lewati.
 */
export async function publishPaidNotification(job: PaidJob, log: Logger): Promise<void> {
  const env = getEnv();
  if (!env.QSTASH_TOKEN) {
    if (env.APP_ENV === "development") {
      log.info("qstash tidak dikonfigurasi (development); notifikasi payment.paid dilewati", {
        transactionId: job.transactionId,
      });
      return;
    }
    log.error("QSTASH_TOKEN kosong di luar development", { transactionId: job.transactionId });
    return;
  }
  await publishJob(`${siteUrl()}/api/jobs/notify`, job, {
    deduplicationId: `payment-paid-${job.transactionId}`,
    retries: 3,
  });
}

/** true bila tag boleh di-revalidate sekarang (SET NX EX). Dev tanpa Upstash / Redis error → true. */
async function acquireThrottle(tag: string): Promise<boolean> {
  const env = getEnv();
  if (env.APP_ENV === "development" && !env.UPSTASH_REDIS_REST_URL) return true;
  try {
    const ok = await getRedis().set(`tk:throttle:revalidate:${tag}`, "1", {
      nx: true,
      ex: REVALIDATE_THROTTLE_SECONDS,
    });
    return ok === "OK";
  } catch {
    return true; // fail-open: lebih baik revalidate berlebih daripada total basi
  }
}

/** revalidateTag `campaign:{slug}` + `campaigns`, masing-masing maksimal 1× per 10 s. */
export async function revalidateCampaignThrottled(campaignId: string, log: Logger): Promise<void> {
  const [row] = await getDb()
    .select({ slug: campaigns.slug })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!row) return;
  for (const tag of [campaignTag(row.slug), CAMPAIGNS_TAG]) {
    if (await acquireThrottle(tag)) {
      revalidateTag(tag, "max");
    } else {
      log.debug("revalidateTag di-throttle", { tag });
    }
  }
}
