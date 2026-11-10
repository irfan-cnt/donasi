import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";
import { getProvider, isProviderConfigured } from "@/lib/payments/registry";

const baseEnv = {
  DATABASE_URL: "postgres://u:p@localhost/db",
  DATABASE_URL_UNPOOLED: "postgres://u:p@localhost/db",
  AUTH_SECRET: "x".repeat(32),
};

describe("registry provider", () => {
  it("tanpa kredensial → tidak terkonfigurasi", () => {
    const env = parseServerEnv(baseEnv);
    expect(isProviderConfigured("midtrans", env)).toBe(false);
    expect(getProvider("midtrans", env)).toBeNull();
  });

  it("adapter Midtrans belum ada (P10) → tetap tidak tersedia walau env lengkap", () => {
    const env = parseServerEnv({
      ...baseEnv,
      MIDTRANS_SERVER_KEY: "SB-Mid-server-test",
      MIDTRANS_CLIENT_KEY: "SB-Mid-client-test",
    });
    expect(getProvider("midtrans", env)).toBeNull();
  });
});
