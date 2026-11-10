import { z } from "zod";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";

// Input route PDF (P19). Kode/token/tipe tidak valid → 404 (tidak membocorkan keberadaan).
export const donorPdfQuery = z.object({
  code: z.string().regex(TRANSACTION_CODE_PATTERN),
  type: z.enum(["summary", "receipt"]),
});

export const guestReceiptQuery = z.object({
  code: z.string().regex(TRANSACTION_CODE_PATTERN),
  t: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
