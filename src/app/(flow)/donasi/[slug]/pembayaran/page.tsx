import { Clock } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";
import { SelectPaymentForm } from "@/components/public/select-payment-form";
import { expiryLabel } from "@/lib/payments/method-groups";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FlowLayout } from "@/components/public/flow-layout";
import { formatRupiah } from "@/lib/money";
import { SITE_NAME } from "@/lib/site";
import { normalizeSlug } from "@/lib/slug";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";
import { getSelectPaymentView } from "@/server/services/payment-service";

// Select Payment (T-20, F-05). Hanya dengan kode transaksi + access token sah (hash cocok, belum
// kedaluwarsa, slug cocok); selain itu 404 (juga dicek lebih dulu di src/proxy.ts).
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
  const view = await getSelectPaymentView(slug, parsed.data.trx, parsed.data.t);
  if (!view) notFound();
  const { transaction: trx, groups } = view;
  const payable = trx.status === "created" || trx.status === "pending";
  const amountLabel = formatRupiah(trx.amount);

  return (
    <FlowLayout title="Pilih Pembayaran" backHref={`/campaign/${slug}`} step={2} withFooter={payable && groups.length > 0}>
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
              {amountLabel}
            </dd>
          </div>
        </dl>
      </section>
      <p className="mt-1 text-right text-xs text-ink-faint">Tanpa biaya tambahan</p>
      {!payable ? (
        <EmptyState
          icon={Clock}
          title="Transaksi tidak dapat dibayar"
          description="Transaksi ini sudah selesai atau tidak lagi menunggu pembayaran."
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Metode pembayaran belum tersedia"
          description="Kami sedang melakukan pemeliharaan sistem pembayaran. Coba lagi beberapa saat lagi."
        />
      ) : (
        <SelectPaymentForm
          slug={slug}
          trx={trx.code}
          token={parsed.data.t}
          initialMethod={view.currentMethod}
          amountLabel={amountLabel}
          groups={groups.map((g) => ({
            key: g.key,
            title: g.title,
            hint: g.hint,
            methods: g.methods.map((m) => ({ code: m.code, name: m.displayName, expiry: expiryLabel(m.expiryMinutes) })),
          }))}
        />
      )}
    </FlowLayout>
  );
}
