import { afterEach, describe, expect, it, vi } from "vitest";
import { parseServerEnv } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost/db",
  DATABASE_URL_UNPOOLED: "postgres://u:p@localhost/db",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "t",
  QSTASH_TOKEN: "t",
  QSTASH_CURRENT_SIGNING_KEY: "k1",
  QSTASH_NEXT_SIGNING_KEY: "k2",
  AUTH_SECRET: "x".repeat(32),
};

describe("env schema", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts a complete env", () => {
    const env = parseServerEnv({ ...valid, MIDTRANS_IS_PRODUCTION: "false" });
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.MIDTRANS_IS_PRODUCTION).toBe(false);
  });

  it("fails fast listing missing keys without leaking values", () => {
    expect(() =>
      parseServerEnv({ ...valid, DATABASE_URL: undefined, AUTH_SECRET: "short" }),
    ).toThrow(/DATABASE_URL.*AUTH_SECRET|AUTH_SECRET.*DATABASE_URL/);
    try {
      parseServerEnv({ ...valid, AUTH_SECRET: "short-secret-value" });
    } catch (e) {
      expect(String(e)).not.toContain("short-secret-value");
    }
  });

  it("getEnv throws on empty env, skips when SKIP_ENV_VALIDATION=1", async () => {
    for (const k of Object.keys(valid)) vi.stubEnv(k, "");
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/Env server tidak valid/);

    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    expect(() => getEnv()).not.toThrow();
  });
});
