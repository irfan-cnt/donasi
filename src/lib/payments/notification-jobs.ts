import type { NotifyJob } from "@/lib/notifications/jobs";
import type { ApplyVerifiedStatusResult } from "./apply-verified-status";

// Job notifikasi turunan hasil applyVerifiedStatus (P16), dipublish pemanggil SETELAH commit.
// payment.paid TIDAK di sini: jalurnya tetap publishPaid + outbox `notification.pending` (§5b).

/** Jam UTC (YYYYMMDDHH) — kunci dedup alert yang tidak terikat payment. */
export const hourBucket = (d = new Date()) => d.toISOString().slice(0, 13).replace(/[-T]/g, "");

export function followUpJobs(result: ApplyVerifiedStatusResult, paymentId: string): NotifyJob[] {
  const jobs: NotifyJob[] = [];
  // payment.failed / payment.expired hanya bila transaksi ikut terminal (tidak ada attempt lain
  // yang pending/paid) — ganti metode (BR-17) tidak memicu email "gagal".
  if (
    result.changed &&
    result.transactionId &&
    (result.newStatus === "failed" || result.newStatus === "expired") &&
    result.transactionStatus === result.newStatus
  ) {
    jobs.push({ event: `payment.${result.newStatus}`, transactionId: result.transactionId, paymentId });
  }
  if (result.alert) {
    jobs.push({
      event: "admin.alert",
      kind: "payment",
      alert: result.alert.kind,
      ref: result.alert.paymentId.slice(0, 80).replace(/[^A-Za-z0-9:_-]/g, "_"),
      paymentId: /^[0-9a-f-]{36}$/i.test(result.alert.paymentId) ? result.alert.paymentId : undefined,
      transactionId: result.alert.transactionId ?? undefined,
    });
  }
  return jobs;
}
