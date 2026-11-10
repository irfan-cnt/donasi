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

    // Dipakai fitur berikutnya; menjadi wajib saat fiturnya diimplementasikan.
    APP_ENCRYPTION_KEY: optionalString,
    AUTH_URL: optionalString,
    AUTH_GOOGLE_ID: optionalString,
    AUTH_GOOGLE_SECRET: optionalString,
    MIDTRANS_SERVER_KEY: optionalString,
    MIDTRANS_CLIENT_KEY: optionalString,
    MIDTRANS_IS_PRODUCTION: booleanFlag,
    MIDTRANS_NOTIFICATION_URL_OVERRIDE: optionalString,
    GMAIL_USER: optionalString,
    GMAIL_APP_PASSWORD: optionalString,
    EMAIL_FROM: optionalString,
    EMAIL_ADMIN_ALERT: optionalString,
    NOTIFICATIONS_ENABLED: booleanFlag,
    WHATSAPP_ENABLED: booleanFlag,
    FONNTE_TOKEN: optionalString,
    FONNTE_API_URL: optionalString,
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
