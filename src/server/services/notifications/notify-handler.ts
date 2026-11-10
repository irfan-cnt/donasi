import "server-only";
import { createGmailSender, createRedisQuotaCounter } from "@/lib/email/gmail";
import { getEnv } from "@/lib/env";
import { createJobHandler, type JobDeps } from "@/lib/jobs/job-route";
import { dedupRef, notifyJobSchema } from "@/lib/notifications/jobs";
import { siteUrl } from "@/lib/site";
import { processNotifyJob, type NotifyDeps } from "@/server/services/notification-service";
import { createEnvFonnteSender } from "@/lib/whatsapp/fonnte";
import { publishNotification, publishWhatsappJob } from "./publish";

/** Konfigurasi runtime dari env (dibaca per request; tanpa nilai secret). */
export function runtimeNotifyConfig(): NotifyDeps["config"] {
  const env = getEnv();
  return {
    enabled: env.NOTIFICATIONS_ENABLED,
    whatsappEnabled: env.WHATSAPP_ENABLED,
    adminEmail: env.EMAIL_ADMIN_ALERT ?? null,
    dailyLimit: env.EMAIL_DAILY_LIMIT,
    siteUrl: siteUrl(),
  };
}

/**
 * POST /api/jobs/notify. Signature QStash wajib (createJobHandler); lock per pesan
 * (`notify:{event}:{ref}`) agar dua pengiriman kembar tidak mengirim dua email.
 * Error kirim → 500 → QStash retry (retries: 3 saat publish).
 */
export function createNotifyHandler(
  deps: Partial<Omit<NotifyDeps, "log">> & JobDeps = {},
): (request: Request) => Promise<Response> {
  return createJobHandler(
    "notify",
    {
      lockTtlMs: 60_000,
      budgetMs: 25_000,
      lockName: (body) => {
        const r = notifyJobSchema.safeParse(body);
        return r.success ? `notify:${r.data.event}:${dedupRef(r.data)}` : "notify:invalid";
      },
    },
    async ({ log, body }) => {
      const summary = await processNotifyJob(body, {
        log,
        sender: deps.sender ?? createGmailSender(),
        quota: deps.quota ?? createRedisQuotaCounter(),
        config: deps.config ?? runtimeNotifyConfig(),
        publishAdminAlert: deps.publishAdminAlert ?? publishNotification,
        whatsapp: deps.whatsapp ?? createEnvFonnteSender(),
        publishWhatsapp: deps.publishWhatsapp ?? publishWhatsappJob,
        whatsappSetting: deps.whatsappSetting,
        now: deps.now ? () => new Date(deps.now!()) : undefined,
      });
      return { ...summary };
    },
    { verify: deps.verify, lock: deps.lock },
  );
}
