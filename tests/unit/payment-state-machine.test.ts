import { describe, expect, it } from "vitest";
import {
  PAYMENT_TRANSITIONS,
  canTransition,
  canTransitionTransaction,
  deriveTransactionStatus,
} from "@/lib/payments/state-machine";
import type { PaymentStatus } from "@/lib/payments/types";

const ALL: PaymentStatus[] = [
  "created",
  "pending",
  "paid",
  "expired",
  "failed",
  "cancelled",
  "refunded",
];

// Tabel BR-20 ditulis ulang secara independen dari implementasi.
const LEGAL = new Set([
  "created>pending",
  "created>failed",
  "pending>paid",
  "pending>expired",
  "pending>failed",
  "pending>cancelled",
  "paid>refunded",
]);

describe("canTransition (payment, BR-20)", () => {
  for (const from of ALL)
    for (const to of ALL) {
      const legal = LEGAL.has(`${from}>${to}`);
      it(`${from} → ${to} = ${legal}`, () => expect(canTransition(from, to)).toBe(legal));
    }

  it("event terlambat setelah paid ditolak", () => {
    for (const to of ["expired", "failed", "cancelled", "pending", "created"] as const)
      expect(canTransition("paid", to)).toBe(false);
  });

  it("tabel mencakup semua status", () => {
    expect(Object.keys(PAYMENT_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });
});

describe("transaksi", () => {
  it("diturunkan dari payment; created tidak mengubah transaksi", () => {
    expect(deriveTransactionStatus("created")).toBeNull();
    expect(deriveTransactionStatus("paid")).toBe("paid");
    expect(deriveTransactionStatus("expired")).toBe("expired");
  });

  it("attempt baru boleh setelah expired/failed/cancelled (BR-11), paid final kecuali refund", () => {
    expect(canTransitionTransaction("expired", "pending")).toBe(true);
    expect(canTransitionTransaction("failed", "pending")).toBe(true);
    expect(canTransitionTransaction("created", "cancelled")).toBe(true);
    expect(canTransitionTransaction("paid", "expired")).toBe(false);
    expect(canTransitionTransaction("paid", "pending")).toBe(false);
    expect(canTransitionTransaction("paid", "refunded")).toBe(true);
    expect(canTransitionTransaction("refunded", "paid")).toBe(false);
  });
});
