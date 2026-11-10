import { z } from "zod";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";

/** Input server action createPayment (F-05). Token mentah 43 karakter base64url. */
export const createPaymentInput = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  trx: z.string().regex(TRANSACTION_CODE_PATTERN),
  t: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  method: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/),
});
export type CreatePaymentInputForm = z.infer<typeof createPaymentInput>;
