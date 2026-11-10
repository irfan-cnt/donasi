import { z } from "zod";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";

/** Param & query halaman /transaksi/[code]/* (P12). Query lain (mis. status=paid) diabaikan. */
export const transactionPageInput = z.object({
  code: z.string().regex(TRANSACTION_CODE_PATTERN),
  t: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

/** Query string `?t=` untuk tautan antar halaman transaksi. */
export function tokenQuery(t: string): string {
  return new URLSearchParams({ t }).toString();
}
