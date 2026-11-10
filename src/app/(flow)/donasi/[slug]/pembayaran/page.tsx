import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FlowLayout } from "@/components/public/flow-layout";
import { formatRupiah } from "@/lib/money";
import { SITE_NAME } from "@/lib/site";
import { normalizeSlug } from "@/lib/slug";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";
import { getTransactionByAccess } from "@/server/services/donation-service";

// Select Payment — PLACEHOLDER P08 (P11 membangun pemilihan metode). Hanya menampilkan ringkasan
// bila kode transaksi + access token sah (hash cocok, belum kedaluwarsa); selain itu 404.
// Token ada di URL → no-referrer & tidak diindeks (security.md §2).
export const instant = false;

export const metadata: Metadata = {
  title: `Pilih Pembayaran — ${SITE_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const querySchema = z.object({
  trx: z.string().regex(TRANSACTION_CODE_PATTERN),
  t: z.string().min(43).max(43),
});

export default async function SelectPaymentPage({
  params,
  searchParams,
}: PageProps<"/donasi/[slug]/pembayaran">) {
  const [{ slug: raw }, query] = await Promise.all([params, searchParams]);
  const slug = normalizeSlug(raw);
  const parsed = querySchema.safeParse(query);
  if (!slug || !parsed.success) notFound();
  const trx = await getTransactionByAccess(slug, parsed.data.trx, parsed.data.t);
  if (!trx) notFound();

  return (
    <FlowLayout title="Pilih Pembayaran" step={2}>
      <section className="rounded-xl border border-border bg-surface p-4" aria-label="Ringkasan donasi">
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
            <dt className="text-ink-faint">Atas nama</dt>
            <dd className="text-right font-medium">{trx.isAnonymous ? "Hamba Allah" : trx.donorName}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2">
            <dt className="font-semibold">Total donasi</dt>
            <dd className="font-bold text-primary-ink tabular-nums" data-testid="trx-amount">
              {formatRupiah(trx.amount)}
            </dd>
          </div>
        </dl>
      </section>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-soft p-4 text-sm text-primary-ink">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Pilihan metode pembayaran sedang disiapkan. Simpan tautan halaman ini untuk melanjutkan pembayaran.
      </p>
    </FlowLayout>
  );
}
