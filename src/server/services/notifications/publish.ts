import "server-only";
import { getEnv } from "@/lib/env";
import type { Logger } from "@/lib/logger";
import { qstashDedupId, type NotifyJob } from "@/lib/notifications/jobs";
import { publishJob } from "@/lib/qstash";
import { siteUrl } from "@/lib/site";

/**
 * publishNotification (T-28): QStash → /api/jobs/notify, retries 3, dedup id per event+ref.
 * Dipanggil SETELAH commit; tidak pernah mengubah status pembayaran. Tanpa QSTASH_TOKEN hanya
 * di development → log & lewati. Pemanggil menangkap error (publish gagal tidak menggagalkan alur).
 */
export async function publishNotification(job: NotifyJob, log: Logger): Promise<void> {
  const env = getEnv();
  if (!env.QSTASH_TOKEN) {
    if (env.APP_ENV === "development") {
      log.info(`qstash tidak dikonfigurasi (development); notifikasi ${job.event} dilewati`);
      return;
    }
    throw new Error("QSTASH_TOKEN kosong di luar development");
  }
  await publishJob(`${siteUrl()}/api/jobs/notify`, job, {
    deduplicationId: qstashDedupId(job),
    retries: 3,
  });
}

/** Versi aman: log error, tidak melempar (untuk efek samping setelah commit). */
export function publishNotificationSafe(job: NotifyJob, log: Logger): Promise<void> {
  return publishNotification(job, log).catch((e: unknown) => {
    log.error(`publish ${job.event} gagal`, { error: e instanceof Error ? e.name : "unknown" });
  });
}
