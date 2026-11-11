import "server-only";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getRedis } from "@/lib/redis";
import { safeError } from "@/lib/safe-error";

/**
 * Cache JSON di Redis (ADR-02: Redis hanya cache, Postgres sumber kebenaran).
 * - APP_ENV=development tanpa Upstash: Redis dilewati (loader dipanggil langsung; hasil tetap
 *   di-cache oleh `"use cache"` pemanggil). Di preview/production env Upstash wajib (env.ts),
 *   jadi jalur ini tidak pernah aktif diam-diam di sana.
 * - Redis error saat runtime: fail-open dengan log warn (integrations.md §Redis).
 * Nilai harus bisa di-serialize lewat `serialize`/`deserialize` (bigint → string).
 */
export async function cachedJson<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  codec: { serialize: (v: T) => unknown; deserialize: (raw: unknown) => T },
): Promise<T> {
  const env = getEnv();
  if (env.APP_ENV === "development" && !env.UPSTASH_REDIS_REST_URL) return loader();

  const redis = getRedis();
  const fullKey = `tk:cache:${key}`;
  try {
    const hit = await redis.get<unknown>(fullKey);
    if (hit !== null && hit !== undefined) return codec.deserialize(hit);
  } catch (error) {
    logger.warn("redis cache get gagal; fail-open", { key, error: safeError(error) });
  }
  const value = await loader();
  try {
    await redis.set(fullKey, codec.serialize(value), { ex: ttlSeconds });
  } catch (error) {
    logger.warn("redis cache set gagal; fail-open", { key, error: safeError(error) });
  }
  return value;
}

/** Hapus entri cache (mis. setelah admin mengubah data). No-op di development tanpa Upstash. */
export async function invalidateCache(key: string): Promise<void> {
  const env = getEnv();
  if (env.APP_ENV === "development" && !env.UPSTASH_REDIS_REST_URL) return;
  try {
    await getRedis().del(`tk:cache:${key}`);
  } catch (error) {
    logger.warn("redis cache del gagal", { key, error: safeError(error) });
  }
}
