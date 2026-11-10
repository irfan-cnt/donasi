import { createHash } from "node:crypto";
import { z } from "zod";

// Data kanonis kuitansi (P19, BR-27/BR-28). PDF dirender ulang dari data ini — bukan dari profil
// donatur terbaru. Byte PDF @react-pdf tidak dijamin deterministik (CreationDate, ID dokumen),
// jadi yang di-hash adalah JSON kanonis data ini, bukan byte PDF.

export const ANONYMOUS_NAME = "Hamba Allah";

/** Bagian yang dibekukan di transactions.receipt_snapshot saat terbit. TANPA nama donatur (PII). */
export const receiptSnapshotSchema = z.object({
  v: z.literal(1),
  receiptNo: z.string().regex(/^KW\/\d{4}\/\d{6}$/),
  issuedAt: z.iso.datetime(),
  paidAt: z.iso.datetime(),
  code: z.string(),
  campaignTitle: z.string(),
  /** bigint rupiah sebagai string digit (JSON tidak punya bigint). */
  amount: z.string().regex(/^\d+$/),
  methodName: z.string(),
  organizationName: z.string(),
  organizationAddress: z.string(),
  signatory: z.string(),
});
export type ReceiptSnapshot = z.infer<typeof receiptSnapshotSchema>;

export interface ReceiptData extends ReceiptSnapshot {
  /** Nama tampilan: nama asli snapshot transaksi, atau "Hamba Allah" bila donatur memilih anonim. */
  donorName: string;
}

export function receiptDonorName(trx: { isAnonymous: boolean; donorNameSnapshot: string }): string {
  return trx.isAnonymous ? ANONYMOUS_NAME : trx.donorNameSnapshot;
}

const KEYS: (keyof ReceiptData)[] = [
  "v",
  "receiptNo",
  "issuedAt",
  "paidAt",
  "code",
  "campaignTitle",
  "amount",
  "methodName",
  "organizationName",
  "organizationAddress",
  "signatory",
  "donorName",
];

/** JSON dengan urutan kunci tetap → input hash yang stabil. */
export function canonicalReceiptJson(data: ReceiptData): string {
  return JSON.stringify(KEYS.map((k) => [k, data[k]]));
}

export function receiptHash(data: ReceiptData): Buffer {
  return createHash("sha256").update(canonicalReceiptJson(data), "utf8").digest();
}
