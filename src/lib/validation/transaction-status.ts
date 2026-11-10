import { z } from "zod";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";

/** GET /api/transactions/[code]/status?t= (P12). */
export const transactionStatusQuery = z.object({
  code: z.string().regex(TRANSACTION_CODE_PATTERN),
  t: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

/** Respons: hanya status & paidAt — tanpa nominal, data donatur, atau id internal. */
export const transactionStatusResponse = z
  .object({
    status: z.enum(["created", "pending", "paid", "expired", "failed", "cancelled", "refunded"]),
    paidAt: z.iso.datetime().nullable(),
  })
  .strict();

export type TransactionStatusResponse = z.infer<typeof transactionStatusResponse>;
