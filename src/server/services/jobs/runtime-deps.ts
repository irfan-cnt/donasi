import "server-only";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import type { Logger } from "@/lib/logger";
import { getProvider } from "@/lib/payments/registry";
import {
  publishPaidNotification,
  revalidateCampaignThrottled,
} from "@/lib/payments/webhook/side-effects";
import { publishJob } from "@/lib/qstash";
import { siteUrl } from "@/lib/site";
import type { AdminAlertJob, JobServiceDeps } from "./job-deps";

/** QStash tersedia? Tanpa token hanya boleh di development (log & lewati). */
function qstashReady(log: Logger, what: string): boolean {
  const env = getEnv();
  if (env.QSTASH_TOKEN) return true;
  if (env.APP_ENV === "development") {
    log.info(`qstash tidak dikonfigurasi (development); ${what} dilewati`);
    return false;
  }
  throw new Error("QSTASH_TOKEN kosong di luar development");
}

/**
 * Alert admin hasil rekonsiliasi → /api/jobs/notify (handler P16 mengirim email ke
 * EMAIL_ADMIN_ALERT). Dedup per tanggal WIB. Rincian ada di audit_logs `reconciliation.issue`.
 */
export async function publishAdminAlert(job: AdminAlertJob, log: Logger): Promise<void> {
  log.error("reconciliation.alert", { date: job.date, ...job.counts });
  if (!qstashReady(log, "alert admin")) return;
  await publishJob(`${siteUrl()}/api/jobs/notify`, job, {
    deduplicationId: `reconcile-alert-${job.date}`,
    retries: 3,
  });
}

/** Batas rantai lanjutan per jadwal (M3 review P14): mencegah loop publish tanpa akhir. */
export const MAX_CONTINUATION_DEPTH = 5;

/** Body lanjutan (ikut ditandatangani QStash); body lain/kosong = run terjadwal (depth 0). */
export const continuationBody = z.object({
  continuation: z.literal(true),
  depth: z.number().int().min(1).max(MAX_CONTINUATION_DEPTH),
});

export function continuationDepth(body: unknown): number {
  const r = continuationBody.safeParse(body);
  return r.success ? r.data.depth : 0;
}

/**
 * Lanjutan job (batch berikutnya) bila anggaran waktu habis, hanya bila depth < maksimum.
 * Dedup per menit + depth. Mengembalikan true bila dipublish.
 */
export async function publishContinuation(
  path: string,
  currentDepth: number,
  log: Logger,
  now = Date.now(),
): Promise<boolean> {
  const depth = currentDepth + 1;
  if (depth > MAX_CONTINUATION_DEPTH) {
    log.warn("lanjutan job mencapai batas depth; sisa menunggu jadwal berikutnya", { depth });
    return false;
  }
  if (!qstashReady(log, "lanjutan job")) return false;
  const bucket = Math.floor(now / 60_000);
  await publishJob(
    `${siteUrl()}${path}`,
    { continuation: true, depth },
    {
      deduplicationId: `${path.replaceAll("/", "-")}-cont-${bucket}-d${depth}`,
      delaySeconds: 5,
      retries: 1,
    },
  );
  return true;
}

export function runtimeJobDeps(log: Logger): JobServiceDeps {
  return {
    log,
    getProvider: (code) => getProvider(code),
    publishPaid: publishPaidNotification,
    revalidateCampaign: revalidateCampaignThrottled,
    publishAdminAlert,
    revalidateTags: (tags) => {
      for (const tag of tags) revalidateTag(tag, "max");
    },
  };
}

/** Tanggal hari ini (YYYY-MM-DD) zona Asia/Jakarta. */
export function jakartaDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
