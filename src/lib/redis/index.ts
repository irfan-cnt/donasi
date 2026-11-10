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

export async function rateLimit(
  name: string,
  identifier: string,
  limit: number,
  window: Window,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const { success, remaining, reset } = await getRateLimiter(name, limit, window).limit(identifier);
  return { success, remaining, reset };
}
