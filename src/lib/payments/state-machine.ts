// State machine payment & transaksi (BR-20, payment-architecture.md §4). Murni, tanpa I/O.
import type { PaymentStatus, TransactionStatus } from "./types";

/** BR-20: created → pending → {paid, expired, failed, cancelled}; paid → refunded (masa depan). */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  created: ["pending", "failed"],
  pending: ["paid", "expired", "failed", "cancelled"],
  paid: ["refunded"],
  expired: [],
  failed: [],
  cancelled: [],
  refunded: [],
};

/**
 * Status transaksi diturunkan dari payment aktif. Transaksi boleh kembali ke `pending` dari
 * expired/failed/cancelled karena satu transaksi boleh punya beberapa attempt (BR-11).
 * created → cancelled = job BR-15. Transisi ke `paid` di DB tetap dijaga
 * `WHERE status NOT IN ('paid','refunded')` (BR-19), bukan hanya tabel ini.
 */
export const TRANSACTION_TRANSITIONS: Readonly<
  Record<TransactionStatus, readonly TransactionStatus[]>
> = {
  created: ["pending", "failed", "cancelled"],
  pending: ["paid", "expired", "failed", "cancelled"],
  expired: ["pending", "paid"],
  failed: ["pending", "paid"],
  cancelled: ["pending", "paid"],
  paid: ["refunded"],
  refunded: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function canTransitionTransaction(from: TransactionStatus, to: TransactionStatus): boolean {
  return TRANSACTION_TRANSITIONS[from].includes(to);
}

/** Status transaksi yang diturunkan dari status payment (null = tidak mengubah transaksi). */
export function deriveTransactionStatus(payment: PaymentStatus): TransactionStatus | null {
  return payment === "created" ? null : payment;
}
