import { beforeEach, describe, expect, it, vi } from "vitest";

// Penjadwalan jeda WA (P17): job whatsapp.send dipublish dengan flow control QStash global.
const publishJob = vi.fn(async () => "msg-1");
const env: Record<string, unknown> = {};
vi.mock("@/lib/qstash", () => ({ publishJob }));
vi.mock("@/lib/env", () => ({ getEnv: () => env }));
vi.mock("@/lib/site", () => ({ siteUrl: () => "https://tebar.example" }));

const { publishWhatsappJob, whatsappFlowControl, WHATSAPP_FLOW_KEY } = await import(
  "@/server/services/notifications/publish"
);
const { createLogger } = await import("@/lib/logger");

const job = {
  event: "whatsapp.send" as const,
  source: "payment.paid" as const,
  transactionId: "0190f0b2-0000-7000-8000-000000000001",
  paymentId: "0190f0b2-0000-7000-8000-000000000002",
};

describe("publishWhatsappJob", () => {
  beforeEach(() => {
    publishJob.mockClear();
    for (const k of Object.keys(env)) delete env[k];
  });

  it("flow control global: parallelism 1, rate 1 per ceil(FONNTE_MIN_DELAY_MS/1000) detik", async () => {
    Object.assign(env, { QSTASH_TOKEN: "q", FONNTE_MIN_DELAY_MS: 2500 });
    await publishWhatsappJob(job, createLogger());
    expect(publishJob).toHaveBeenCalledWith("https://tebar.example/api/jobs/notify", job, {
      deduplicationId: `wa-payment-paid-${job.transactionId}`,
      retries: 3,
      flowControl: { key: WHATSAPP_FLOW_KEY, parallelism: 1, rate: 1, periodSeconds: 3 },
    });
  });

  it("periode minimal 1 detik; default 3 detik bila env kosong", () => {
    expect(whatsappFlowControl(200).periodSeconds).toBe(1);
    expect(whatsappFlowControl(Number(undefined) || 3000).periodSeconds).toBe(3);
  });

  it("tanpa QSTASH_TOKEN → melempar (baris tetap queued, tidak pernah kirim langsung)", async () => {
    await expect(publishWhatsappJob(job, createLogger())).rejects.toThrow(/QSTASH_TOKEN/);
    expect(publishJob).not.toHaveBeenCalled();
  });
});
