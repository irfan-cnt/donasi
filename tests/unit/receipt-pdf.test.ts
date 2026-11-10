import { describe, expect, it } from "vitest";
import { renderReceiptPdf, renderSummaryPdf } from "@/lib/pdf/documents";
import {
  ANONYMOUS_NAME,
  canonicalReceiptJson,
  receiptDonorName,
  receiptHash,
  type ReceiptData,
} from "@/lib/pdf/receipt-data";

const data: ReceiptData = {
  v: 1,
  receiptNo: "KW/2026/000001",
  issuedAt: "2026-11-10T03:00:00.000Z",
  paidAt: "2026-11-10T03:00:00.000Z",
  code: "TK-261110-ABCDEF",
  campaignTitle: "Beasiswa Santri",
  amount: "1250000",
  methodName: "BCA Virtual Account",
  organizationName: "Tebar Kebaikan",
  organizationAddress: "Jl. Contoh No. 1, Jakarta",
  signatory: "Pengurus Tebar Kebaikan",
  donorName: "Ani Lestari",
};

describe("data kuitansi (P19)", () => {
  it("hash stabil & bergantung pada isi, bukan urutan kunci objek", () => {
    const reordered = Object.fromEntries(Object.entries(data).reverse()) as unknown as ReceiptData;
    expect(receiptHash(reordered).equals(receiptHash(data))).toBe(true);
    expect(canonicalReceiptJson(reordered)).toBe(canonicalReceiptJson(data));
    expect(receiptHash({ ...data, amount: "1250001" }).equals(receiptHash(data))).toBe(false);
    expect(receiptHash(data)).toHaveLength(32);
  });

  it("nama asli; 'Hamba Allah' hanya bila donatur memilih anonim", () => {
    expect(receiptDonorName({ isAnonymous: false, donorNameSnapshot: "Ani" })).toBe("Ani");
    expect(receiptDonorName({ isAnonymous: true, donorNameSnapshot: "Ani" })).toBe(ANONYMOUS_NAME);
  });
});

describe("render PDF (P19)", () => {
  it("kuitansi: PDF valid, judul memuat nomor kuitansi, font tertanam", async () => {
    const pdf = await renderReceiptPdf(data);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("Kuitansi KW/2026/000001");
    expect(text).toMatch(/\/FontFile2/); // TrueType tertanam (Plus Jakarta Sans), bukan font standar
    expect(text).toMatch(/PlusJakartaSans/);
    expect(text).not.toMatch(/\/Helvetica/);
  }, 30_000);

  it("ringkasan: PDF valid", async () => {
    const pdf = await renderSummaryPdf({
      organizationName: "Tebar Kebaikan",
      organizationAddress: "",
      code: data.code,
      statusLabel: "Menunggu pembayaran",
      campaignTitle: data.campaignTitle,
      donorName: "Ani",
      amount: 50_000n,
      createdAt: new Date(),
      paidAt: null,
      methodName: null,
      receiptNo: null,
      generatedAt: new Date(),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain(`Ringkasan transaksi ${data.code}`);
  }, 30_000);
});
