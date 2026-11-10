import "server-only";
import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const booleanFlag = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const DEPLOYED_REQUIRED = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  "APP_ENCRYPTION_KEY",
  // P14: URL kanonik untuk verifikasi signature QStash & tujuan publish job.
  "APP_URL",
  // P16: email notifikasi Gmail SMTP. Development boleh kosong (tes memakai transport palsu).
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "EMAIL_FROM",
  "EMAIL_ADMIN_ALERT",
] as const;

/** Ambil env opsional yang dibutuhkan fitur tertentu; error berisi NAMA variabel saja. */
export function requireEnvValue<K extends keyof ServerEnv>(
  env: ServerEnv,
  key: K,
): NonNullable<ServerEnv[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Env ${String(key)} belum diisi`);
  }
  return value as NonNullable<ServerEnv[K]>;
}

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
    APP_URL: z
      .url()
      .optional()
      .or(z.literal("").transform(() => undefined)),

    DATABASE_URL: z.url(),
    DATABASE_URL_UNPOOLED: z.url(),
    // Wajib di preview/production (lihat superRefine); boleh kosong saat APP_ENV=development
    // agar fitur yang belum memakainya (mis. login donatur) bisa dikembangkan lebih dulu.
    UPSTASH_REDIS_REST_URL: z
      .url()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    UPSTASH_REDIS_REST_TOKEN: optionalString,
    QSTASH_TOKEN: optionalString,
    QSTASH_CURRENT_SIGNING_KEY: optionalString,
    QSTASH_NEXT_SIGNING_KEY: optionalString,
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET minimal 32 karakter"),

    // AES-256-GCM (totp_secret admin): base64 dari 32 byte. Wajib di preview/production.
    APP_ENCRYPTION_KEY: optionalString.refine(
      (v) => v === undefined || Buffer.from(v, "base64").length === 32,
      "harus base64 dari 32 byte",
    ),

    // Dipakai fitur berikutnya; menjadi wajib saat fiturnya diimplementasikan.
    AUTH_URL: optionalString,
    AUTH_GOOGLE_ID: optionalString,
    AUTH_GOOGLE_SECRET: optionalString,
    MIDTRANS_SERVER_KEY: optionalString,
    MIDTRANS_CLIENT_KEY: optionalString,
    MIDTRANS_IS_PRODUCTION: booleanFlag,
    MIDTRANS_NOTIFICATION_URL_OVERRIDE: optionalString,
    // P15: Vercel Deployment Protection bypass; hanya diteruskan ke job QStash saat APP_ENV=preview.
    VERCEL_AUTOMATION_BYPASS_SECRET: optionalString,
    GMAIL_USER: optionalString,
    GMAIL_APP_PASSWORD: optionalString,
    EMAIL_FROM: optionalString,
    EMAIL_ADMIN_ALERT: optionalString,
    // P16: kuota harian Gmail (akun biasa ±500/hari, Workspace ±2000/hari); alert admin > 80%.
    EMAIL_DAILY_LIMIT: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().int().positive().default(500),
    ),
    NOTIFICATIONS_ENABLED: booleanFlag,
    WHATSAPP_ENABLED: booleanFlag,
    FONNTE_TOKEN: optionalString,
    // P17: endpoint kirim Fonnte (docs.fonnte.com/api-send-message). Wajib https.
    FONNTE_API_URL: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.url({ protocol: /^https$/ }).default("https://api.fonnte.com/send"),
    ),
    // P17: jeda minimal antar pesan WA (global, satu nomor pengirim) via QStash flow control.
    FONNTE_MIN_DELAY_MS: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().int().min(1000).max(600_000).default(3000),
    ),
    BLOB_READ_WRITE_TOKEN: optionalString,
    SENTRY_DSN: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "development") {
      for (const key of DEPLOYED_REQUIRED) {
        if (!env[key])
          ctx.addIssue({ code: "custom", path: [key], message: "wajib di preview/production" });
      }
    }
    // P17: token Fonnte wajib hanya bila kanal WhatsApp diaktifkan.
    if (env.WHATSAPP_ENABLED && !env.FONNTE_TOKEN) {
      ctx.addIssue({ code: "custom", path: ["FONNTE_TOKEN"], message: "wajib bila WHATSAPP_ENABLED=true" });
    }
    // Midtrans (P10): selain production wajib sandbox; prefix kunci harus sesuai mode.
    if (env.APP_ENV !== "production" && env.MIDTRANS_IS_PRODUCTION) {
      ctx.addIssue({
        code: "custom",
        path: ["MIDTRANS_IS_PRODUCTION"],
        message: "harus false di development/preview",
      });
    }
    // Production wajib Midtrans production (tanpa pengecualian staging).
    if (env.APP_ENV === "production" && !env.MIDTRANS_IS_PRODUCTION) {
      ctx.addIssue({
        code: "custom",
        path: ["MIDTRANS_IS_PRODUCTION"],
        message: "harus true di production",
      });
    }
    // P13: override URL notifikasi hanya untuk development/preview, wajib https.
    if (env.MIDTRANS_NOTIFICATION_URL_OVERRIDE) {
      if (env.APP_ENV === "production") {
        ctx.addIssue({
          code: "custom",
          path: ["MIDTRANS_NOTIFICATION_URL_OVERRIDE"],
          message: "tidak boleh diisi di production",
        });
      } else if (
        !z.url({ protocol: /^https$/ }).safeParse(env.MIDTRANS_NOTIFICATION_URL_OVERRIDE).success
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["MIDTRANS_NOTIFICATION_URL_OVERRIDE"],
          message: "harus URL https",
        });
      }
    }
    const sandboxKeys = [
      ["MIDTRANS_SERVER_KEY", "SB-Mid-server-"],
      ["MIDTRANS_CLIENT_KEY", "SB-Mid-client-"],
    ] as const;
    for (const [key, prefix] of sandboxKeys) {
      const value = env[key];
      if (!value) continue;
      if (!env.MIDTRANS_IS_PRODUCTION && !value.startsWith(prefix)) {
        ctx.addIssue({ code: "custom", path: [key], message: `harus kunci sandbox (${prefix}…)` });
      }
      if (env.MIDTRANS_IS_PRODUCTION && value.startsWith("SB-")) {
        ctx.addIssue({ code: "custom", path: [key], message: "kunci sandbox di mode production" });
      }
    }
    // Login donatur Google (P04): wajib di production. Di development/preview boleh kosong
    // (tombol Google gagal dengan pesan umum; e2e memakai sesi uji dari DB).
    if (env.APP_ENV !== "production") return;
    for (const key of ["AUTH_URL", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const) {
      if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "wajib di production" });
    }
    if (env.AUTH_URL && !env.AUTH_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["AUTH_URL"], message: "harus https di production" });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parse & validasi env; melempar error berisi NAMA variabel (tanpa nilai) bila tidak valid. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Env server tidak valid — ${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/**
 * Env server tervalidasi (lazy, di-cache). Gagal cepat saat pertama dipakai di runtime.
 * `SKIP_ENV_VALIDATION=1` hanya untuk CI/build tanpa secret: tidak memvalidasi.
 */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return process.env as unknown as ServerEnv;
  }
  cached = parseServerEnv(process.env);
  return cached;
}
