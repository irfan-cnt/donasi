import { CheckCircle2, Download, LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FlowLayout } from "@/components/public/flow-layout";
import { TransactionSummary } from "@/components/public/transaction/transaction-summary";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";
import { tokenQuery, transactionPageInput } from "@/lib/validation/transaction-page";
import { getTransactionView } from "@/server/services/payment-service";

// Donasi berhasil (T-21, F-07). Hanya bila status DB `paid`; query string apa pun (mis.
// ?status=paid) diabaikan — selain paid → halaman menunggu (AC-07.1). Tidak mengubah status.
export const instant = false;

export const metadata: Metadata = {
  title: `Donasi Berhasil — ${SITE_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SuccessPage({ params, searchParams }: PageProps<"/transaksi/[code]/berhasil">) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const parsed = transactionPageInput.safeParse({ code, t: query.t });
  if (!parsed.success) notFound();
  const view = await getTransactionView(parsed.data.code, parsed.data.t);
  if (!view) notFound();
  if (view.transaction.status !== "paid") {
    redirect(`/transaksi/${view.transaction.code}/menunggu?${tokenQuery(parsed.data.t)}`);
  }
  const session = await auth();
  const guest = !session?.user?.id;

  return (
    <FlowLayout title="Donasi Berhasil">
      <div className="text-center" data-testid="payment-success">
        <div className="relative mx-auto mt-4 flex size-24 items-center justify-center">
          <div className="pattern-islamic-dark absolute inset-0 rounded-full bg-success-soft" />
          <CheckCircle2 className="relative size-14 text-success" strokeWidth={1.75} aria-hidden />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold">Jazakallah khairan!</h2>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">
          Donasimu telah kami terima. Semoga Allah membalas kebaikanmu dengan pahala yang terus mengalir.
        </p>
        <TransactionSummary view={view} />
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {/* Kuitansi PDF (P19, T-34): token akses transaksi; halaman ini no-referrer. */}
          <a
            href={`/api/transactions/${view.transaction.code}/receipt?${tokenQuery(parsed.data.t)}`}
            download
            rel="noreferrer"
            data-testid="receipt-download"
            aria-describedby="receipt-note"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Download aria-hidden />
            Unduh Kuitansi (PDF)
          </a>
          <Link
            href={`/campaign/${view.transaction.campaignSlug}`}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Lihat program
          </Link>
        </div>
        <p id="receipt-note" className="mt-2 text-xs text-ink-faint">
          Tautan unduh kuitansi berlaku selama tautan transaksi ini aktif (7 hari). Setelahnya, masuk untuk mengunduh kapan saja.
        </p>
        {guest && (
          <section className="mt-6 rounded-xl border border-primary/20 bg-primary-soft/50 p-4 text-left" aria-label="Ajakan masuk">
            <p className="font-semibold">Simpan riwayat donasimu</p>
            <p className="mt-1 text-sm text-ink-soft">
              Masuk dengan Google memakai email yang sama untuk melihat semua donasi dan mengunduh kuitansi kapan saja.
            </p>
            <Link href="/masuk?callbackUrl=%2Fakun" className={buttonVariants({ className: "mt-3" })}>
              <LogIn aria-hidden />
              Masuk dengan Google
            </Link>
          </section>
        )}
        <Link href="/" className={buttonVariants({ variant: "ghost", className: "mt-4" })}>
          Kembali ke Beranda
        </Link>
      </div>
    </FlowLayout>
  );
}
