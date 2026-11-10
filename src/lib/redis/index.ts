import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getEnv, requireEnvValue } from "@/lib/env";

let redis: Redis | undefined;

export function getRedis(): Redis {
  if (!redis) {
    const env = getEnv();
    redis = new Redis({
      url: requireEnvValue(env, "UPSTASH_REDIS_REST_URL"),
      token: requireEnvValue(env, "UPSTASH_REDIS_REST_TOKEN"),
    });
  }
  return redis;
}

type Window = `${number} ${"s" | "m" | "h" | "d"}`;
const limiters = new Map<string, Ratelimit>();

/** Rate limiter sliding-window per nama kebijakan (mis. "checkout", 5 per "1 m"). */
export function getRateLimiter(name: string, limit: number, window: Window): Ratelimit {
  const key = `${name}:${limit}:${window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `tk:rl:${name}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

// Fallback in-memory KHUSUS APP_ENV=development tanpa Upstash (fixed window per proses).
// Tidak pernah dipakai di preview/production: di sana env Upstash wajib (env.ts).
const memoryHits = new Map<string, { count: number; reset: number }>();

function windowMs(window: Window): number {
  const [n, unit] = window.split(" ") as [string, "s" | "m" | "h" | "d"];
  const mult = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return Number(n) * mult;
}

function memoryLimit(key: string, limit: number, window: Window, now = Date.now()) {
  let entry = memoryHits.get(key);
  if (!entry || entry.reset <= now) {
    entry = { count: 0, reset: now + windowMs(window) };
    memoryHits.set(key, entry);
  }
  entry.count += 1;
  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.reset,
  };
}

function shouldUseMemoryFallback(): boolean {
  const env = getEnv();
  return env.APP_ENV === "development" && !env.UPSTASH_REDIS_REST_URL;
}

export async function rateLimit(
  name: string,
  identifier: string,
  limit: number,
  window: Window,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (shouldUseMemoryFallback()) return memoryLimit(`${name}:${identifier}`, limit, window);
  const { success, remaining, reset } = await getRateLimiter(name, limit, window).limit(identifier);
  return { success, remaining, reset };
}

// Lock singkat (SET NX PX) untuk mencegah klik ganda; pemilik dicek saat melepas.
// Fallback in-memory KHUSUS APP_ENV=development tanpa Upstash (per proses).
const memoryLocks = new Map<string, { owner: string; exp: number }>();

/** Ambil lock `tk:lock:{name}` selama `ttlMs`; kembalikan token pemilik atau null bila terkunci. */
export async function acquireLock(name: string, ttlMs: number): Promise<string | null> {
  const owner = crypto.randomUUID();
  const key = `tk:lock:${name}`;
  if (shouldUseMemoryFallback()) {
    const now = Date.now();
    const cur = memoryLocks.get(key);
    if (cur && cur.exp > now) return null;
    memoryLocks.set(key, { owner, exp: now + ttlMs });
    return owner;
  }
  const ok = await getRedis().set(key, owner, { nx: true, px: ttlMs });
  return ok === "OK" ? owner : null;
}

/** Lepas lock hanya bila masih dimiliki `owner` (tidak melepas lock milik request lain). */
export async function releaseLock(name: string, owner: string): Promise<void> {
  const key = `tk:lock:${name}`;
  if (shouldUseMemoryFallback()) {
    if (memoryLocks.get(key)?.owner === owner) memoryLocks.delete(key);
    return;
  }
  await getRedis().eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
    [key],
    [owner],
  );
}
