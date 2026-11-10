import "server-only";
import { and, desc, eq, gt, inArray, isNull, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { paymentMethods, payments, platformSettings, transactions } from "@/lib/db/schema";

// Akses DB kuitansi & PDF transaksi (P19). Hanya MEMBACA transaksi, kecuali membekukan
// receipt_snapshot/receipt_hash sekali (WHERE receipt_hash IS NULL). Tidak pernah mengubah status.

export type ReceiptSourceRow = NonNullable<Awaited<ReturnType<typeof findReceiptSource>>>;

async function findReceiptSource(where: SQL) {
  const [row] = await getDb()
    .select({
      id: transactions.id,
      code: transactions.code,
      donorId: transactions.donorId,
      status: transactions.status,
      amount: transactions.amount,
      campaignTitleSnapshot: transactions.campaignTitleSnapshot,
      donorNameSnapshot: transactions.donorNameSnapshot,
      donorEmailSnapshot: transactions.donorEmailSnapshot,
      isAnonymous: transactions.isAnonymous,
      createdAt: transactions.createdAt,
      paidAt: transactions.paidAt,
      receiptNo: transactions.receiptNo,
      receiptIssuedAt: transactions.receiptIssuedAt,
      receiptSnapshot: transactions.receiptSnapshot,
      receiptHash: transactions.receiptHash,
    })
    .from(transactions)
    .where(where)
    .limit(1);
  return row ? { ...row, amount: BigInt(row.amount) } : undefined;
}

export const findReceiptSourceById = (id: string) => findReceiptSource(eq(transactions.id, id));

/** Ownership: hanya transaksi milik donor sesi (donor lain → undefined → 404). */
export const findReceiptSourceForDonor = (donorId: string, code: string) =>
  findReceiptSource(and(eq(transactions.donorId, donorId), eq(transactions.code, code))!);

/** Tamu: kode + hash access token yang belum kedaluwarsa. */
export const findReceiptSourceForToken = (code: string, tokenHash: Buffer, now: Date) =>
  findReceiptSource(
    and(eq(transactions.code, code), eq(transactions.accessTokenHash, tokenHash), gt(transactions.accessTokenExpiresAt, now))!,
  );

/** Nama metode dari payment terakhir (paid diutamakan). Tanpa data provider. */
export async function findTransactionMethodName(transactionId: string): Promise<string | null> {
  const rows = await getDb()
    .select({ status: payments.status, name: paymentMethods.displayName })
    .from(payments)
    .innerJoin(paymentMethods, eq(payments.paymentMethodId, paymentMethods.id))
    .where(eq(payments.transactionId, transactionId))
    .orderBy(desc(payments.createdAt));
  return (rows.find((r) => r.status === "paid") ?? rows.find((r) => r.status !== "created"))?.name ?? null;
}

export async function findReceiptSettings(): Promise<{ name?: string; address?: string; signatory?: string }> {
  const rows = await getDb()
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings)
    .where(inArray(platformSettings.key, ["organization.name", "organization.address", "receipt.signatory"]));
  const get = (k: string) => {
    const v = rows.find((r) => r.key === k)?.value;
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return { name: get("organization.name"), address: get("organization.address"), signatory: get("receipt.signatory") };
}

/** Bekukan isi kuitansi sekali. false bila sudah dibekukan lebih dulu (race) atau bukan paid. */
export async function freezeReceipt(id: string, snapshot: Record<string, unknown>, hash: Buffer): Promise<boolean> {
  const rows = await getDb()
    .update(transactions)
    .set({ receiptSnapshot: snapshot, receiptHash: hash })
    .where(and(eq(transactions.id, id), eq(transactions.status, "paid"), isNull(transactions.receiptHash)))
    .returning({ id: transactions.id });
  return rows.length > 0;
}
