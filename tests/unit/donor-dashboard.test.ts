import { describe, expect, it } from "vitest";
import {
  accountDeletionSchema,
  decodeDonorCursor,
  donorListQuery,
  donorProfileSchema,
  encodeDonorCursor,
} from "@/lib/validation/donor";
import { buildTimeline } from "@/server/services/donor-account-service";

const t = (iso: string) => new Date(iso);

describe("cursor riwayat donor", () => {
  it("round-trip & menolak cursor rusak", () => {
    const c = { createdAt: t("2026-11-01T01:02:03.456Z"), id: "01a1c67f-dbc0-70f2-b4fb-0129bb33a882" };
    expect(decodeDonorCursor(encodeDonorCursor(c))).toEqual(c);
    expect(decodeDonorCursor("xx")).toBeNull();
    expect(decodeDonorCursor("../etc")).toBeNull();
    expect(decodeDonorCursor(Buffer.from('{"c":"bukan","i":"1"}').toString("base64url"))).toBeNull();
    expect(decodeDonorCursor(undefined)).toBeNull();
  });

  it("query filter tidak valid diabaikan", () => {
    expect(donorListQuery.parse({ status: "paid", tahun: "2026" })).toMatchObject({ status: "paid", tahun: 2026 });
    expect(donorListQuery.parse({ status: "hack", tahun: "x" })).toMatchObject({ status: undefined, tahun: undefined });
  });
});

describe("profil donatur (AC-15.1)", () => {
  it("menormalisasi WA ke +62", () => {
    const r = donorProfileSchema.parse({ name: " Ahmad ", phone: "0812-3456-7890", whatsappOptIn: "on", defaultAnonymous: null });
    expect(r).toEqual({ name: "Ahmad", phoneE164: "+6281234567890", whatsappOptIn: true, defaultAnonymous: false });
    expect(donorProfileSchema.parse({ name: "Ahmad", phone: "+62 812 3456 7890" }).phoneE164).toBe("+6281234567890");
  });

  it("menolak WA tidak valid & opt-in WA tanpa nomor", () => {
    expect(donorProfileSchema.safeParse({ name: "Ahmad", phone: "12345" }).success).toBe(false);
    const r = donorProfileSchema.safeParse({ name: "Ahmad", phone: "", whatsappOptIn: "on" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["phone"]);
    expect(donorProfileSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("konfirmasi hapus akun wajib HAPUS", () => {
    expect(accountDeletionSchema.safeParse({ confirm: "hapus" }).success).toBe(true);
    expect(accountDeletionSchema.safeParse({ confirm: "ya" }).success).toBe(false);
  });
});

describe("buildTimeline", () => {
  const trx = {
    status: "paid" as const,
    createdAt: t("2026-11-09T01:14:00Z"),
    paidAt: t("2026-11-09T01:15:00Z"),
    updatedAt: t("2026-11-09T01:15:00Z"),
    receiptNo: null,
    receiptIssuedAt: null,
  };

  it("created → pending (metode) → paid, berurutan waktu", () => {
    const steps = buildTimeline({
      trx,
      payments: [
        { id: "p1", status: "expired", methodName: "BCA VA", createdAt: t("2026-11-09T01:14:10Z"), updatedAt: t("2026-11-09T01:14:20Z"), paidAt: null },
        { id: "p2", status: "paid", methodName: "QRIS", createdAt: t("2026-11-09T01:14:30Z"), updatedAt: t("2026-11-09T01:15:00Z"), paidAt: t("2026-11-09T01:15:00Z") },
      ],
      events: [{ paymentId: "p1", statusReported: "expire", receivedAt: t("2026-11-09T01:14:25Z") }],
    });
    expect(steps.map((s) => s.label)).toEqual([
      "Donasi dibuat",
      "Menunggu pembayaran · BCA VA",
      "Pembayaran kedaluwarsa",
      "Menunggu pembayaran · QRIS",
      "Pembayaran diterima",
    ]);
    expect(steps[2]!.at).toEqual(t("2026-11-09T01:14:25Z"));
  });

  it("transaksi ditutup tanpa payment → langkah status transaksi", () => {
    const steps = buildTimeline({
      trx: { ...trx, status: "expired", paidAt: null, updatedAt: t("2026-11-10T01:00:00Z") },
      payments: [],
      events: [],
    });
    expect(steps.map((s) => s.label)).toEqual(["Donasi dibuat", "Pembayaran kedaluwarsa"]);
  });
});
