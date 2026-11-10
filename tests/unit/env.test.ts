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
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
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

describe("env schema — auth Google (P04)", () => {
  it("boleh kosong di development", () => {
    const env = parseServerEnv({ ...valid, APP_ENV: "development", AUTH_GOOGLE_ID: "" });
    expect(env.AUTH_GOOGLE_ID).toBeUndefined();
  });

  it("wajib & https di production", () => {
    expect(() => parseServerEnv({ ...valid, APP_ENV: "production" })).toThrow(
      /AUTH_URL.*AUTH_GOOGLE_ID.*AUTH_GOOGLE_SECRET/,
    );
    expect(() =>
      parseServerEnv({
        ...valid,
        APP_ENV: "production",
        AUTH_URL: "http://example.org",
        AUTH_GOOGLE_ID: "id",
        AUTH_GOOGLE_SECRET: "s",
      }),
    ).toThrow(/AUTH_URL: harus https/);
    expect(
      parseServerEnv({
        ...valid,
        APP_ENV: "production",
        AUTH_URL: "https://example.org",
        AUTH_GOOGLE_ID: "id",
        AUTH_GOOGLE_SECRET: "s",
      }).APP_ENV,
    ).toBe("production");
  });
});

describe("env schema — Upstash/QStash", () => {
  const withoutUpstash = { ...valid, UPSTASH_REDIS_REST_URL: undefined, QSTASH_TOKEN: undefined };

  it("boleh kosong di development, requireEnvValue gagal dengan nama variabel", async () => {
    const env = parseServerEnv({ ...withoutUpstash, APP_ENV: "development" });
    const { requireEnvValue } = await import("@/lib/env");
    expect(() => requireEnvValue(env, "QSTASH_TOKEN")).toThrow("Env QSTASH_TOKEN belum diisi");
  });

  it("wajib di preview", () => {
    expect(() => parseServerEnv({ ...withoutUpstash, APP_ENV: "preview" })).toThrow(
      /UPSTASH_REDIS_REST_URL.*QSTASH_TOKEN/,
    );
  });
});

describe("env schema — APP_ENCRYPTION_KEY (P05)", () => {
  it("boleh kosong di development, wajib di preview/production", () => {
    expect(parseServerEnv({ ...valid, APP_ENCRYPTION_KEY: "" }).APP_ENCRYPTION_KEY).toBeUndefined();
    expect(() => parseServerEnv({ ...valid, APP_ENV: "preview", APP_ENCRYPTION_KEY: "" })).toThrow(
      /APP_ENCRYPTION_KEY: wajib/,
    );
  });

  it("menolak kunci yang bukan 32 byte tanpa membocorkan nilainya", () => {
    const bad = Buffer.alloc(16, 1).toString("base64");
    try {
      parseServerEnv({ ...valid, APP_ENCRYPTION_KEY: bad });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).toMatch(/APP_ENCRYPTION_KEY: harus base64 dari 32 byte/);
      expect(String(e)).not.toContain(bad);
    }
  });
});
