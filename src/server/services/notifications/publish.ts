import "server-only";
import { getEnv } from "@/lib/env";
import type { Logger } from "@/lib/logger";
import { qstashDedupId, type NotifyJob, type WhatsappJob } from "@/lib/notifications/jobs";
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

/** Kunci flow control QStash global untuk semua pesan WA (satu nomor pengirim Fonnte). */
export const WHATSAPP_FLOW_KEY = "tk-whatsapp-fonnte";

/** Opsi flow control: 1 pesan aktif sekaligus, maksimal 1 pesan per FONNTE_MIN_DELAY_MS (dibulatkan ke atas, detik). */
export function whatsappFlowControl(minDelayMs: number) {
  return {
    key: WHATSAPP_FLOW_KEY,
    parallelism: 1,
    rate: 1,
    periodSeconds: Math.max(1, Math.ceil(minDelayMs / 1000)),
  };
}

/**
 * P17: job `whatsapp.send` → /api/jobs/notify dengan flow control global (jeda antar pesan WA
 * tanpa menunda email). Tanpa QSTASH_TOKEN di development → error agar baris tetap `queued`
 * (tidak pernah mengirim WA langsung tanpa antrean).
 */
export async function publishWhatsappJob(job: WhatsappJob, log: Logger): Promise<void> {
  const env = getEnv();
  if (!env.QSTASH_TOKEN) {
    log.warn("qstash tidak dikonfigurasi; job whatsapp.send tidak dipublish");
    throw new Error("QSTASH_TOKEN kosong; job WhatsApp tidak dapat diantrekan");
  }
  await publishJob(`${siteUrl()}/api/jobs/notify`, job, {
    deduplicationId: qstashDedupId(job),
    retries: 3,
    flowControl: whatsappFlowControl(Number(env.FONNTE_MIN_DELAY_MS) || 3000),
  });
}
