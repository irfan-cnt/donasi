// Kontrak provider pembayaran (docs/03-technical/payment-architecture.md §2).
// Uang = bigint rupiah. Tidak ada secret di file ini.

export type ProviderCode = "midtrans"; // tambah 'xendit' bila OD-03 dibuka kembali
export const PROVIDER_CODES = ["midtrans"] as const satisfies readonly ProviderCode[];

export type MethodType = "qris" | "ewallet" | "virtual_account" | "retail" | "card";

export type PaymentStatus =
  "created" | "pending" | "paid" | "expired" | "failed" | "cancelled" | "refunded";

/** Status transaksi memakai himpunan nilai yang sama (enum DB terpisah). */
export type TransactionStatus = PaymentStatus;

export interface CreatePaymentInput {
  /** UUID internal → idempotency key / order_id. */
  paymentId: string;
  transactionCode: string;
  amount: bigint;
  method: { code: string; type: MethodType; providerChannel: string };
  customer: { name: string; email: string; phone?: string };
  description: string;
  /** Id item (campaign id) untuk item_details provider; fallback transactionCode. */
  campaignId?: string;
  expiresInMinutes: number;
  /** Hanya untuk UX, bukan bukti bayar (BR-18). */
  successRedirectUrl: string;
}

export interface PaymentInstruction {
  kind: "virtual_account" | "qr" | "redirect" | "payment_code";
  bankName?: string;
  vaNumber?: string;
  qrString?: string;
  qrImageUrl?: string;
  paymentUrl?: string;
  paymentCode?: string;
  /** Mandiri Bill (echannel): kode perusahaan & kode bayar. */
  billerCode?: string;
  billKey?: string;
  expiresAt: Date;
  /** Ter-redaksi. */
  raw?: Record<string, unknown>;
}

export interface CreatePaymentResult {
  providerRef: string;
  status: PaymentStatus;
  instruction: PaymentInstruction;
}

export interface StatusResult {
  providerRef: string;
  status: PaymentStatus;
  paidAmount?: bigint;
  paidAt?: Date;
  /** capture + fraud_status challenge: tetap pending, butuh review manual. */
  needsReview?: boolean;
  /** Refund parsial (P25, OD-28): tidak diterapkan otomatis. */
  partialRefund?: boolean;
  raw: unknown;
}

export interface VerifiedWebhook {
  eventId: string;
  providerRef: string;
  orderId: string;
  status: PaymentStatus;
  amount: bigint;
  paidAt?: Date;
  needsReview?: boolean;
  raw: unknown;
}

export interface ProviderPaymentRef {
  providerRef: string;
  orderId: string;
}

export interface PaymentProvider {
  readonly code: ProviderCode;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(ref: ProviderPaymentRef): Promise<StatusResult>;
  /** Melempar error bila tanda tangan/isi tidak valid. */
  verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<VerifiedWebhook>;
  /**
   * Cek signature lokal saja (sinkron, timing-safe, tanpa I/O). Dipakai sebelum menyimpan apa pun;
   * BUKAN pengganti verifyWebhook (yang juga cross-check status API).
   */
  checkWebhookSignature(req: { headers: Headers; rawBody: string }): boolean;
  getPaymentInstructions(payment: {
    providerRef: string;
    instruction: PaymentInstruction;
  }): PaymentInstruction;
  expirePayment(ref: ProviderPaymentRef): Promise<void>;
}
