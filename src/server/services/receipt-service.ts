import "server-only";
import { renderReceiptPdf, renderSummaryPdf } from "@/lib/pdf/documents";
import {
  receiptDonorName,
  receiptHash,
  receiptSnapshotSchema,
  type ReceiptData,
  type ReceiptSnapshot,
} from "@/lib/pdf/receipt-data";
import { sha256 } from "@/lib/security/crypto";
import { SITE_NAME } from "@/lib/site";
import {
  findReceiptSettings,
  findReceiptSourceById,
  findReceiptSourceForDonor,
  findReceiptSourceForToken,
  findTransactionMethodName,
  freezeReceipt,
  type ReceiptSourceRow,
} from "@/server/repositories/receipt-repository";

// Kuitansi & ringkasan PDF (P19, T-34, F-14, BR-27/BR-28). Lihat payment-architecture.md
// "Kuitansi (P19)". Kuitansi hanya untuk status `paid` + receipt_no (selain itu null → 404).
// Isi dibekukan sekali (receipt_snapshot + receipt_hash); render ulang selalu dari snapshot itu
// + donor_name_snapshot transaksi (bukan profil donor terbaru).

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const STATUS_LABEL: Record<string, string> = {
  created: "Dibuat",
  pending: "Menunggu pembayaran",
  paid: "Berhasil",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
};

export interface PdfFile {
  filename: string;
  body: Buffer;
}

async function buildSnapshot(row: ReceiptSourceRow): Promise<ReceiptSnapshot> {
  const [settings, methodName] = await Promise.all([findReceiptSettings(), findTransactionMethodName(row.id)]);
  const name = settings.name ?? SITE_NAME;
  return {
    v: 1,
    receiptNo: row.receiptNo!,
    issuedAt: (row.receiptIssuedAt ?? row.paidAt!).toISOString(),
    paidAt: row.paidAt!.toISOString(),
    code: row.code,
    campaignTitle: row.campaignTitleSnapshot,
    amount: row.amount.toString(),
    methodName: methodName ?? "-",
    organizationName: name,
    organizationAddress: settings.address ?? "",
    signatory: settings.signatory ?? `Pengurus ${name}`,
  };
}

/**
 * Data kuitansi; membekukan snapshot + hash pada pemanggilan pertama (job receipt.issued atau
 * unduhan pertama, mana yang lebih dulu). null bila bukan paid / belum bernomor.
 */
export async function ensureReceipt(row: ReceiptSourceRow): Promise<ReceiptData | null> {
  if (row.status !== "paid" || !row.receiptNo || !row.paidAt) return null;
  const donorName = receiptDonorName(row);
  const stored = receiptSnapshotSchema.safeParse(row.receiptSnapshot);
  if (row.receiptHash && stored.success) return { ...stored.data, donorName };
  const snapshot = await buildSnapshot(row);
  const data: ReceiptData = { ...snapshot, donorName };
  if (await freezeReceipt(row.id, snapshot, receiptHash(data))) return data;
  // Dibekukan proses lain di antara baca & tulis → pakai versi yang tersimpan.
  const fresh = await findReceiptSourceById(row.id);
  const frozen = receiptSnapshotSchema.safeParse(fresh?.receiptSnapshot);
  return fresh && frozen.success ? { ...frozen.data, donorName: receiptDonorName(fresh) } : null;
}

const receiptFilename = (receiptNo: string) => `kuitansi-${receiptNo.replace(/\//g, "-")}.pdf`;

export async function receiptPdf(row: ReceiptSourceRow): Promise<PdfFile | null> {
  const data = await ensureReceipt(row);
  if (!data) return null;
  return { filename: receiptFilename(data.receiptNo), body: await renderReceiptPdf(data) };
}

async function summaryPdf(row: ReceiptSourceRow, now: Date): Promise<PdfFile> {
  const [settings, methodName] = await Promise.all([findReceiptSettings(), findTransactionMethodName(row.id)]);
  const body = await renderSummaryPdf({
    organizationName: settings.name ?? SITE_NAME,
    organizationAddress: settings.address ?? "",
    code: row.code,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
    campaignTitle: row.campaignTitleSnapshot,
    donorName: receiptDonorName(row),
    amount: row.amount,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    methodName,
    receiptNo: row.receiptNo,
    generatedAt: now,
  });
  return { filename: `transaksi-${row.code}.pdf`, body };
}

/** Donor (sesi): ownership lewat filter donorId. Bukan miliknya / tidak ada / bukan paid → null. */
export async function donorTransactionPdf(
  donorId: string,
  code: string,
  type: "summary" | "receipt",
  now = new Date(),
): Promise<PdfFile | null> {
  const row = await findReceiptSourceForDonor(donorId, code);
  if (!row) return null;
  return type === "receipt" ? receiptPdf(row) : summaryPdf(row, now);
}

/** Tamu: kuitansi dengan access token transaksi (berlaku sampai access_token_expires_at). */
export async function guestReceiptPdf(code: string, token: string, now = new Date()): Promise<PdfFile | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const row = await findReceiptSourceForToken(code, sha256(token), now);
  return row ? receiptPdf(row) : null;
}

/** Untuk job receipt.issued: transaksi + PDF kuitansi (null bila belum/bukan paid). */
export async function receiptForTransaction(transactionId: string) {
  const row = await findReceiptSourceById(transactionId);
  if (!row) return null;
  const pdf = await receiptPdf(row);
  return pdf ? { row, pdf } : null;
}
