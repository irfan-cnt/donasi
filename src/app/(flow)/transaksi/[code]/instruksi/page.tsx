import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FlowLayout } from "@/components/public/flow-layout";
import { formatRupiah } from "@/lib/money";
import { SITE_NAME } from "@/lib/site";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";
import { getInstructionView } from "@/server/services/payment-service";

// Instruksi pembayaran — PLACEHOLDER P11 (P12 menampilkan nomor VA/QR, hitung mundur & status).
// Hanya dengan kode transaksi + access token sah; selain itu 404 (juga di src/proxy.ts).
export const instant = false;

export const metadata: Metadata = {
  title: `Instruksi Pembayaran — ${SITE_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const querySchema = z.object({ t: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export default async function InstructionPage({
  params,
  searchParams,
}: PageProps<"/transaksi/[code]/instruksi">) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const parsed = querySchema.safeParse(query);
  if (!TRANSACTION_CODE_PATTERN.test(code) || !parsed.success) notFound();
  const view = await getInstructionView(code, parsed.data.t);
  if (!view) notFound();
  const { transaction: trx, payment } = view;

  return (
    <FlowLayout title="Selesaikan Pembayaran" step={3}>
      <section className="rounded-xl border border-border bg-surface p-4" aria-label="Ringkasan pembayaran">
        <p className="text-xs text-ink-faint">Kode transaksi</p>
        <p className="font-mono text-sm font-semibold" data-testid="trx-code">
          {trx.code}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-faint">Program</dt>
            <dd className="min-w-0 text-right font-medium">{trx.campaignTitle}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-faint">Status</dt>
            <dd className="text-right font-medium" data-testid="payment-status">
              {payment?.status === "pending" ? "Menunggu pembayaran" : trx.status === "paid" ? "Berhasil" : "Belum ada pembayaran aktif"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold text-primary-ink tabular-nums">{formatRupiah(trx.amount)}</dd>
          </div>
        </dl>
      </section>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-soft p-4 text-sm text-primary-ink">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Instruksi pembayaran lengkap sedang disiapkan. Simpan tautan halaman ini untuk melanjutkan.
      </p>
    </FlowLayout>
  );
}
