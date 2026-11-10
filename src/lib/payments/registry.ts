import "server-only";
import { getEnv, type ServerEnv } from "@/lib/env";
import { createMidtransFromEnv } from "./midtrans";
import type { PaymentProvider, ProviderCode } from "./types";

interface ProviderEntry {
  /** Env kredensial lengkap? (tanpa membaca/mengembalikan nilainya). */
  hasCredentials(env: ServerEnv): boolean;
  /**
   * Factory adapter. `null` = adapter belum diimplementasikan → provider
   * dianggap tidak terkonfigurasi. Tidak ada adapter palsu di src (BR-18).
   */
  create: ((env: ServerEnv) => PaymentProvider) | null;
}

const REGISTRY: Record<ProviderCode, ProviderEntry> = {
  midtrans: {
    hasCredentials: (env) => !!env.MIDTRANS_SERVER_KEY && !!env.MIDTRANS_CLIENT_KEY,
    create: createMidtransFromEnv,
  },
};

const instances = new Map<ProviderCode, PaymentProvider>();

/** Provider siap pakai = env lengkap DAN adapter tersedia. */
export function isProviderConfigured(code: ProviderCode, env: ServerEnv = getEnv()): boolean {
  const entry = REGISTRY[code];
  return !!entry && entry.create !== null && entry.hasCredentials(env);
}

/**
 * Kembalikan provider hanya bila terkonfigurasi; selain itu `null` (metodenya disembunyikan
 * dari checkout).
 */
export function getProvider(code: ProviderCode, env: ServerEnv = getEnv()): PaymentProvider | null {
  if (!isProviderConfigured(code, env)) return null;
  let p = instances.get(code);
  if (!p) {
    p = REGISTRY[code].create!(env);
    instances.set(code, p);
  }
  return p;
}
