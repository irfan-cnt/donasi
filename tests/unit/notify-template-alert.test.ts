// P23 L1: template aktif yang tidak valid → notifikasi donatur `skipped` DAN admin.alert
// `template_invalid` (dedup per event+kanal per hari WIB lewat dedup_key/QStash id).
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  claimed: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/server/repositories/notification-repository", () => ({
  findNotificationContext: async () => ({
    transactionId: "0196f000-0000-7000-8000-000000000001",
    code: "TK-261109-7QF3KD",
    transactionStatus: "paid",
    amount: 100000n,
    campaignTitle: "Uji",
    donorName: "Ani",
    donorEmail: "ani@example.test",
    donorPhone: null,
    whatsappOptIn: false,
    createdAt: new Date("2026-11-10T03:00:00Z"),
    payment: { status: "paid", instruction: {}, expiresAt: null, methodName: "BCA VA", methodInstructions: [] },
  }),
  findActiveTemplate: async () => ({ id: "t1", version: 3, subject: "Halo", body: "KTP {{donor_ktp}}" }),
  findOrganizationSettings: async () => ({}),
  findWhatsappEnabledSetting: async () => false,
  claimNotificationLog: async (row: Record<string, unknown>) => {
    repo.claimed.push(row);
    return { id: `log-${repo.claimed.length}`, status: row.status, attempt: 0, created: true };
  },
  updateNotificationLog: async (_id: string, patch: Record<string, unknown>) => {
    repo.updates.push(patch);
  },
  hasSentLog: async () => false,
  findLogById: async () => null,
  findLatestPaymentId: async () => null,
  notificationLockKey: (...a: string[]) => a.join(":"),
  withNotificationLock: async <T,>(_k: string, fn: () => Promise<T>) => fn(),
}));

import { createLogger } from "@/lib/logger";
import { notifyJobSchema, qstashDedupId } from "@/lib/notifications/jobs";
import { processNotifyJob, renderAdminAlert, type NotifyDeps } from "@/server/services/notification-service";

describe("L1: template aktif rusak", () => {
  beforeEach(() => {
    repo.claimed.length = 0;
    repo.updates.length = 0;
  });

  it("payment.paid: email skipped + admin.alert template_invalid (dedup harian)", async () => {
    const publishAdminAlert = vi.fn<NotifyDeps["publishAdminAlert"]>(async () => {});
    const send = vi.fn();
    const deps: NotifyDeps = {
      log: createLogger({ test: "l1" }),
      sender: { send },
      quota: { increment: async () => 1, once: async () => false },
      config: { enabled: true, whatsappEnabled: false, adminEmail: null, dailyLimit: 100, siteUrl: "https://tebar.example" },
      publishAdminAlert,
      whatsapp: { send: vi.fn() },
      publishWhatsapp: async () => {},
      now: () => new Date("2026-11-10T20:00:00Z"),
    };
    const out = await processNotifyJob(
      { event: "payment.paid", transactionId: "0196f000-0000-7000-8000-000000000001", paymentId: "0196f000-0000-7000-8000-000000000002" },
      deps,
    );
    expect(out).toMatchObject({ email: "skipped" });
    expect(send).not.toHaveBeenCalled();
    expect(repo.claimed[0]).toMatchObject({ status: "skipped", errorMessage: "template tidak aktif" });
    expect(publishAdminAlert).toHaveBeenCalledTimes(1);
    const alert = publishAdminAlert.mock.calls[0]![0];
    expect(alert).toEqual({ event: "admin.alert", kind: "template_invalid", alert: "payment_paid_email", date: "2026-11-11" });
    const job = notifyJobSchema.parse(alert);
    expect(qstashDedupId(job)).toBe("admin-alert-template_invalid-payment_paid_email-2026-11-11");
    expect(renderAdminAlert(alert).subject).toMatch(/Template notifikasi aktif tidak valid/);
  });
});
