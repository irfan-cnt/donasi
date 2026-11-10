import { Hourglass, Mail, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FlowLayout } from "@/components/public/flow-layout";
import { StatusPoller } from "@/components/public/transaction/status-poller";
import { TransactionSummary } from "@/components/public/transaction/transaction-summary";
import { buttonVariants } from "@/components/ui/button";
import { getEnv } from "@/lib/env";
import { SITE_NAME } from "@/lib/site";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";
import { tokenQuery, transactionPageInput } from "@/lib/validation/transaction-page";
import { getTransactionView } from "@/server/services/payment-service";

// Menunggu pembayaran (T-21, F-08). Juga target callback_url e-wallet Midtrans, yang sengaja
// TANPA access token → tanpa ?t= halaman generik: tidak ada query DB, tidak ada data transaksi
// (payment-architecture.md §3c). Halaman ini tidak pernah mengubah status (BR-18).
export const instant = false;

export const metadata: Metadata = {
  title: `Menunggu Pembayaran — ${SITE_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PendingPage({ params, searchParams }: PageProps<"/transaksi/[code]/menunggu">) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  if (query.t === undefined) {
    if (!TRANSACTION_CODE_PATTERN.test(code)) notFound();
    return <GenericPending />;
  }
  const parsed = transactionPageInput.safeParse({ code, t: query.t });
  if (!parsed.success) notFound();
  const { t } = parsed.data;
  const view = await getTransactionView(parsed.data.code, t);
  if (!view) notFound();
  const { transaction: trx, payment } = view;
  const qs = tokenQuery(t);
  if (trx.status === "paid") redirect(`/transaksi/${trx.code}/berhasil?${qs}`);

  const payable = trx.status === "created" || trx.status === "pending";
  const waiting = payable && payment?.status === "pending";
  const selectHref = payable
    ? `/donasi/${trx.campaignSlug}/pembayaran?${new URLSearchParams({ trx: trx.code, t })}`
    : `/donasi/${trx.campaignSlug}`;

  return (
    <FlowLayout title={waiting ? "Menunggu Pembayaran" : "Pembayaran Belum Berhasil"}>
      <div className="text-center" data-testid={waiting ? "payment-pending" : "payment-not-completed"}>
        <div
          className={`mx-auto mt-4 flex size-24 items-center justify-center rounded-full ${waiting ? "bg-warning-soft" : "bg-danger-soft"}`}
        >
          {waiting ? (
            <Hourglass className="size-12 text-warning" strokeWidth={1.75} aria-hidden />
          ) : (
            <XCircle className="size-12 text-danger" strokeWidth={1.75} aria-hidden />
          )}
        </div>
        <h2 className="mt-5 text-2xl font-bold">
          {waiting ? "Pembayaranmu sedang kami tunggu" : "Pembayaran belum berhasil"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">
          {waiting
            ? "Jika kamu sudah membayar, konfirmasi biasanya masuk dalam 1–5 menit. Halaman ini memperbarui status secara otomatis."
            : payment?.status === "expired"
              ? "Waktu pembayaran sudah habis. Silakan buat pembayaran baru."
              : "Belum ada pembayaran aktif untuk transaksi ini. Silakan pilih metode pembayaran."}
        </p>
        {waiting && (
          <div className="mt-3 flex justify-center">
            <StatusPoller code={trx.code} token={t} allowTestHook={getEnv().APP_ENV !== "production"} />
          </div>
        )}
        <TransactionSummary view={view} />
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {waiting ? (
            <Link prefetch={false} href={`/transaksi/${trx.code}/instruksi?${qs}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              Lihat instruksi
            </Link>
          ) : (
            <Link href={selectHref} prefetch={false} className={buttonVariants({ size: "lg", className: "sm:col-span-2" })}>
              {payable ? "Pilih metode pembayaran" : "Donasi lagi"}
            </Link>
          )}
          {waiting && (
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Kembali ke Beranda
            </Link>
          )}
        </div>
        <p className="mt-6 rounded-xl bg-primary-soft p-4 text-left text-sm text-primary-ink">
          Sudah bayar tapi status belum berubah? Simpan bukti bayar, lalu hubungi kami dengan menyertakan kode
          transaksi.
        </p>
      </div>
    </FlowLayout>
  );
}

/** Tanpa access token (callback e-wallet): tidak ada data transaksi sama sekali. */
function GenericPending() {
  return (
    <FlowLayout title="Pembayaran Diproses">
      <div className="text-center" data-testid="payment-generic">
        <div className="mx-auto mt-4 flex size-24 items-center justify-center rounded-full bg-warning-soft">
          <Hourglass className="size-12 text-warning" strokeWidth={1.75} aria-hidden />
        </div>
        <h2 className="mt-5 text-2xl font-bold">Pembayaran sedang diproses</h2>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">
          Terima kasih. Bila pembayaran berhasil, konfirmasi biasanya masuk dalam 1–5 menit dan kami kirimkan ke
          email-mu.
        </p>
        <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-xl bg-primary-soft p-4 text-left text-sm text-primary-ink">
          <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
          Untuk melihat status donasi, buka tautan &quot;Lihat status pembayaran&quot; dari email konfirmasi kami.
        </p>
        <Link href="/" className={buttonVariants({ variant: "ghost", className: "mt-6" })}>
          Kembali ke Beranda
        </Link>
      </div>
    </FlowLayout>
  );
}
