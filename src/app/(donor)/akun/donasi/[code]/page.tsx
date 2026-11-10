import { CalendarDays, CheckCircle2, Clock, Download, FileText, ShieldCheck, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatWibDateTime } from "@/components/donor/format";
import { TrxStatusBadge } from "@/components/donor/trx-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireDonor } from "@/lib/auth";
import { formatRupiah } from "@/lib/money";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { donorTrxCode } from "@/lib/validation/donor";
import { continuePaymentAction } from "@/server/actions/donor-actions";
import { getDonorTransactionDetail, type TimelineStep } from "@/server/services/donor-account-service";

export const metadata: Metadata = { title: `Detail Donasi — ${SITE_NAME}`, robots: { index: false, follow: false } };

const DOT: Record<TimelineStep["tone"], string> = {
  done: "bg-primary text-white",
  success: "bg-primary text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
};

// Detail transaksi milik donor (F-13, AC-13.1). Kode milik orang lain / tidak ada → 404.
export default async function DonorTransactionDetailPage({ params, searchParams }: PageProps<"/akun/donasi/[code]">) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const limited = query.batas === "1";
  const parsed = donorTrxCode.safeParse(code);
  if (!parsed.success) notFound();
  const donor = await requireDonor(`/akun/donasi/${parsed.data}`);
  const detail = await getDonorTransactionDetail(donor.donorId, parsed.data);
  if (!detail) notFound();
  const { trx, timeline, news, methodName } = detail;
  const payable = trx.status === "created" || trx.status === "pending";

  const rows: [string, string][] = [
    ["Metode", methodName ?? "—"],
    trx.paidAt ? ["Dibayar", formatWibDateTime(trx.paidAt)] : ["Dibuat", formatWibDateTime(trx.createdAt)],
    ["Nama di publik", trx.isAnonymous ? "Hamba Allah" : trx.donorName],
  ];
  if (trx.receiptNo) rows.push(["No. kuitansi", trx.receiptNo]);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-ink md:text-2xl">Detail Donasi</h1>
        <Link href="/akun/donasi" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← Kembali
        </Link>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-faint">Kode transaksi</p>
              <p className="font-mono font-semibold break-all" data-testid="trx-code">
                {trx.code}
              </p>
            </div>
            <TrxStatusBadge status={trx.status} />
          </div>
          <p className="mt-4 text-3xl font-bold text-primary-ink tabular-nums">{formatRupiah(trx.amount)}</p>
          <p className="mt-1 text-sm break-words text-ink-soft">{trx.campaignTitle}</p>
          <dl className="mt-5 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-ink-faint">{k}</dt>
                <dd className="font-medium break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {trx.prayer && (
            <blockquote className="mt-5 rounded-xl bg-muted p-3 text-sm break-words text-ink-soft italic">
              “{trx.prayer}”
            </blockquote>
          )}
          {payable && limited && (
            <p className="mt-5 rounded-xl bg-warning-soft p-3 text-sm text-ink" role="alert">
              Terlalu sering meminta tautan pembayaran baru. Silakan coba lagi dalam satu jam.
            </p>
          )}
          {payable && (
            <form action={continuePaymentAction} className="mt-5">
              <input type="hidden" name="code" value={trx.code} />
              <Button type="submit">Lanjutkan bayar</Button>
            </form>
          )}
          <h2 className="mt-6 font-semibold text-ink">Riwayat status</h2>
          <ol className="mt-3 space-y-4" data-testid="timeline">
            {timeline.map((s) => (
              <li key={s.key} className="flex gap-3">
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", DOT[s.tone])}>
                  {s.tone === "danger" ? (
                    <XCircle className="size-3.5" aria-hidden />
                  ) : s.tone === "warning" ? (
                    <Clock className="size-3.5" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-ink">{s.label}</p>
                  <p className="flex items-center gap-1 text-xs text-ink-faint">
                    <CalendarDays className="size-3" aria-hidden />
                    {formatWibDateTime(s.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="space-y-3">
          <section className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-semibold text-ink">Dokumen</p>
            {/* PDF transaksi & kuitansi menyusul di P19 (F-14). */}
            <Button variant="outline" className="mt-3 w-full justify-start" disabled>
              <FileText aria-hidden />
              Bukti Transaksi (PDF)
            </Button>
            <Button className="mt-2 w-full justify-start" disabled>
              <Download aria-hidden />
              Kuitansi Donasi (PDF)
            </Button>
            <p className="mt-3 flex gap-1.5 text-xs text-ink-faint">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              Unduhan PDF segera tersedia. Dokumen hanya bisa diunduh oleh pemilik akun.
            </p>
          </section>
          {news && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-ink">Kabar terbaru program</p>
              <p className="mt-1 text-sm break-words text-ink-soft">{news.title}</p>
              <Link
                href={`/campaign/${trx.campaignSlug}/berita/${news.slug}`}
                className="mt-2 inline-block text-sm font-semibold text-primary"
              >
                Baca kabar →
              </Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
