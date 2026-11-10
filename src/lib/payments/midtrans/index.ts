import "server-only";
import type { ServerEnv } from "@/lib/env";
import type { PaymentProvider } from "../types";
import { recordMidtransEvent } from "./event-log";
import { createMidtransProvider } from "./provider";

export { MidtransError } from "./errors";
export { createMidtransProvider } from "./provider";

/** Factory registry: kredensial dari env tervalidasi (lihat superRefine MIDTRANS_* di env.ts). */
export function createMidtransFromEnv(env: ServerEnv): PaymentProvider {
  if (!env.MIDTRANS_SERVER_KEY) throw new Error("Env MIDTRANS_SERVER_KEY belum diisi");
  return createMidtransProvider({
    serverKey: env.MIDTRANS_SERVER_KEY,
    isProduction: env.MIDTRANS_IS_PRODUCTION,
    recordEvent: recordMidtransEvent,
  });
}
