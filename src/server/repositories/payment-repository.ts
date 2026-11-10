import "server-only";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb, getTxDb } from "@/lib/db";
import {
  auditLogs,
  campaigns,
  paymentMethods,
  paymentProviders,
  payments,
  transactions,
} from "@/lib/db/schema";
import { buildAuditRow } from "@/lib/audit/audit-row";
import type { PaymentInstruction, ProviderCode } from "@/lib/payments/types";

const methodColumns = {
  id: paymentMethods.id,
  code: paymentMethods.code,
  type: paymentMethods.type,
  displayName: paymentMethods.displayName,
  logoUrl: paymentMethods.logoUrl,
  minAmount: paymentMethods.minAmount,
  maxAmount: paymentMethods.maxAmount,
  expiryMinutes: paymentMethods.expiryMinutes,
  displayOrder: paymentMethods.displayOrder,
  providerChannel: paymentMethods.providerChannel,
  providerId: paymentMethods.providerId,
  providerCode: paymentProviders.code,
};

export type MethodRow = {
  id: string;
  code: string;
  type: "qris" | "ewallet" | "virtual_account" | "retail" | "card";
  displayName: string;
  logoUrl: string | null;
  minAmount: bigint;
  maxAmount: bigint | null;
  expiryMinutes: number;
  displayOrder: number;
  providerChannel: string;
  providerId: string;
  providerCode: ProviderCode;
};

/** Metode aktif milik provider yang di-enable admin (konfigurasi env dicek di service). */
export async function listActiveMethodRows(): Promise<MethodRow[]> {
  const rows = await getDb()
    .select(methodColumns)
    .from(paymentMethods)
    .innerJoin(paymentProviders, eq(paymentMethods.providerId, paymentProviders.id))
    .where(and(eq(paymentMethods.isActive, true), eq(paymentProviders.isEnabled, true)))
    .orderBy(asc(paymentMethods.displayOrder), asc(paymentMethods.code));
  return rows as MethodRow[];
}

/** Metode aktif berdasarkan kode — selalu dibaca segar dari DB (bukan cache) saat membuat pembayaran. */
export async function findActiveMethodByCode(code: string): Promise<MethodRow | undefined> {
  const [row] = await getDb()
    .select(methodColumns)
    .from(paymentMethods)
    .innerJoin(paymentProviders, eq(paymentMethods.providerId, paymentProviders.id))
    .where(
      and(
        eq(paymentMethods.code, code),
        eq(paymentMethods.isActive, true),
        eq(paymentProviders.isEnabled, true),
      ),
    )
    .orderBy(asc(paymentProviders.priority))
    .limit(1);
  return row as MethodRow | undefined;
}

/** Transaksi untuk pembayaran — hanya bila kode + hash token cocok & belum kedaluwarsa. */
export async function findPayableTransaction(code: string, tokenHash: Buffer, now: Date) {
  const [row] = await getDb()
    .select({
      id: transactions.id,
      code: transactions.code,
      amount: transactions.amount,
      status: transactions.status,
      campaignId: transactions.campaignId,
      campaignSlug: campaigns.slug,
      campaignTitle: transactions.campaignTitleSnapshot,
      donorName: transactions.donorNameSnapshot,
      donorEmail: transactions.donorEmailSnapshot,
      isAnonymous: transactions.isAnonymous,
      donorPhone: transactions.donorPhoneSnapshot,
      createdAt: transactions.createdAt,
      paidAt: transactions.paidAt,
    })
    .from(transactions)
    .innerJoin(campaigns, eq(transactions.campaignId, campaigns.id))
    .where(
      and(
        eq(transactions.code, code),
        eq(transactions.accessTokenHash, tokenHash),
        gt(transactions.accessTokenExpiresAt, now),
      ),
    )
    .limit(1);
  return row;
}
export type PayableTransaction = NonNullable<Awaited<ReturnType<typeof findPayableTransaction>>>;

export interface ActivePaymentRow {
  id: string;
  status: "pending" | "paid";
  providerRef: string | null;
  expiresAt: Date | null;
  methodCode: string;
  providerCode: ProviderCode;
}

/** Payment aktif (pending/paid) transaksi — maksimal satu (payments_one_active_per_tx_idx). */
export async function findActivePayment(transactionId: string): Promise<ActivePaymentRow | undefined> {
  const [row] = await getDb()
    .select({
      id: payments.id,
      status: payments.status,
      providerRef: payments.providerRef,
      expiresAt: payments.expiresAt,
      methodCode: paymentMethods.code,
      providerCode: paymentProviders.code,
    })
    .from(payments)
    .innerJoin(paymentMethods, eq(payments.paymentMethodId, paymentMethods.id))
    .innerJoin(paymentProviders, eq(payments.providerId, paymentProviders.id))
    .where(and(eq(payments.transactionId, transactionId), inArray(payments.status, ["pending", "paid"])))
    .limit(1);
  return row as ActivePaymentRow | undefined;
}

/** Baris payment `created` (belum ada di provider; tidak terkena indeks satu-aktif). */
export async function insertCreatedPayment(values: {
  id: string;
  transactionId: string;
  paymentMethodId: string;
  providerId: string;
  amount: bigint;
}): Promise<void> {
  await getDb()
    .insert(payments)
    .values({ ...values, status: "created" });
}

/** created → failed (createPayment provider gagal / dibatalkan sebelum aktif). */
export async function markPaymentFailed(id: string, reason: string, providerRef?: string): Promise<void> {
  await getDb()
    .update(payments)
    .set({
      status: "failed",
      failureReason: reason.slice(0, 500),
      ...(providerRef ? { providerRef } : {}),
      updatedAt: sql`now()`,
    })
    .where(and(eq(payments.id, id), eq(payments.status, "created")));
}

export type ActivateOutcome = "activated" | "transaction_closed";

/**
 * SATU transaksi DB: kunci transaksi, batalkan payment lama yang masih pending (BR-17; sudah
 * di-expire ke provider), aktifkan payment baru (created → pending + data provider), dan set
 * transaksi `pending`. Transaksi tidak pernah terlihat `cancelled` di antaranya.
 * Pelanggaran indeks satu-aktif (klik ganda lolos lock) dilempar ke pemanggil.
 */
export async function activatePayment(args: {
  transactionId: string;
  paymentId: string;
  cancelPaymentId: string | null;
  providerRef: string;
  instruction: PaymentInstruction;
  expiresAt: Date;
}): Promise<ActivateOutcome> {
  return getTxDb().transaction(async (tx) => {
    const locked = await tx.execute<{ status: string }>(
      sql`SELECT status FROM transactions WHERE id = ${args.transactionId} FOR UPDATE`,
    );
    const status = locked.rows[0]?.status;
    if (!status || status === "paid" || status === "refunded") {
      await tx
        .update(payments)
        .set({ status: "failed", failureReason: "transaksi sudah ditutup", updatedAt: sql`now()` })
        .where(and(eq(payments.id, args.paymentId), eq(payments.status, "created")));
      return "transaction_closed";
    }
    if (args.cancelPaymentId) {
      await tx
        .update(payments)
        .set({ status: "cancelled", failureReason: "diganti metode lain", updatedAt: sql`now()` })
        .where(and(eq(payments.id, args.cancelPaymentId), eq(payments.status, "pending")));
    }
    const updated = await tx
      .update(payments)
      .set({
        status: "pending",
        providerRef: args.providerRef,
        instruction: args.instruction,
        expiresAt: args.expiresAt,
        updatedAt: sql`now()`,
      })
      .where(and(eq(payments.id, args.paymentId), eq(payments.status, "created")))
      .returning({ id: payments.id });
    if (updated.length !== 1) throw new Error("payment baru tidak lagi berstatus created");
    await tx
      .update(transactions)
      .set({ status: "pending", updatedAt: sql`now()` })
      .where(
        and(
          eq(transactions.id, args.transactionId),
          sql`${transactions.status} NOT IN ('paid','refunded')`,
        ),
      );
    return "activated";
  });
}

/** Payment lama sudah di-expire ke provider tetapi payment baru gagal → tandai cancelled. */
export async function cancelPendingPayment(id: string, reason: string): Promise<void> {
  await getDb()
    .update(payments)
    .set({ status: "cancelled", failureReason: reason.slice(0, 500), updatedAt: sql`now()` })
    .where(and(eq(payments.id, id), eq(payments.status, "pending")));
}

/** Anomali: charge masih hidup di provider tanpa payment aktif (audit `payment.orphan_charge`). */
export async function recordOrphanCharge(m: {
  transactionId: string;
  paymentId: string;
  providerRef: string;
  cause: string;
  error: string;
}): Promise<void> {
  await getDb()
    .insert(auditLogs)
    .values(
      buildAuditRow({
        actor: { type: "system" },
        action: "payment.orphan_charge",
        entityType: "payment",
        entityId: m.paymentId,
        metadata: m,
      }),
    );
}

/** Status ringan untuk endpoint polling (P12): hanya bila kode + hash token cocok & berlaku. */
export async function findTransactionStatus(code: string, tokenHash: Buffer, now: Date) {
  const [row] = await getDb()
    .select({ status: transactions.status, paidAt: transactions.paidAt })
    .from(transactions)
    .where(
      and(
        eq(transactions.code, code),
        eq(transactions.accessTokenHash, tokenHash),
        gt(transactions.accessTokenExpiresAt, now),
      ),
    )
    .limit(1);
  return row;
}

export interface PaymentViewRow {
  status: "created" | "pending" | "paid" | "expired" | "failed" | "cancelled" | "refunded";
  instruction: unknown;
  expiresAt: Date | null;
  methodCode: string;
  methodType: MethodRow["type"];
  methodName: string;
  instructions: unknown;
}

/**
 * Payment untuk halaman instruksi/hasil: payment aktif (pending/paid) bila ada, selain itu payment
 * terakhir (expired/failed/cancelled) agar state kedaluwarsa/gagal bisa ditampilkan.
 */
export async function findPaymentForView(transactionId: string): Promise<PaymentViewRow | undefined> {
  const [row] = await getDb()
    .select({
      status: payments.status,
      instruction: payments.instruction,
      expiresAt: payments.expiresAt,
      methodCode: paymentMethods.code,
      methodType: paymentMethods.type,
      methodName: paymentMethods.displayName,
      instructions: paymentMethods.instructions,
    })
    .from(payments)
    .innerJoin(paymentMethods, eq(payments.paymentMethodId, paymentMethods.id))
    .where(and(eq(payments.transactionId, transactionId), sql`${payments.status} <> 'created'`))
    .orderBy(sql`(${payments.status} IN ('pending', 'paid')) DESC`, desc(payments.createdAt), desc(payments.id))
    .limit(1);
  return row as PaymentViewRow | undefined;
}
