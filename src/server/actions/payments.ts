"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/http/client-ip";
import { requestLogger } from "@/lib/logger";
import { createPaymentForTransaction } from "@/server/services/payment-service";
import { safeError } from "@/lib/safe-error";

export interface PaymentFormState {
  error?: string;
  /** Kode referensi (requestId) untuk dukungan. */
  reference?: string;
}

const FIELDS = ["slug", "trx", "t", "method"] as const;

/** Server action pilih metode → createPayment → instruksi (F-05). Input divalidasi Zod di service. */
export async function createPaymentAction(
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const requestId = randomUUID();
  const reference = `REQ-${requestId.slice(0, 8).toUpperCase()}`;
  const log = requestLogger(requestId).child({ action: "createPayment", reference });

  const raw: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const v = formData.get(key);
    raw[key] = typeof v === "string" ? v : undefined;
  }

  let target: string;
  try {
    const result = await createPaymentForTransaction(raw, log, undefined, clientIp(await headers()));
    if (!result.ok) return { error: result.message, reference };
    target = `/transaksi/${result.code}/instruksi?${new URLSearchParams({ t: String(raw.t) })}`;
  } catch (error) {
    log.error("createPayment gagal", { error: safeError(error) });
    return {
      error: "Pembayaran belum dapat dibuat karena gangguan sistem. Silakan coba lagi.",
      reference,
    };
  }
  redirect(target);
}
