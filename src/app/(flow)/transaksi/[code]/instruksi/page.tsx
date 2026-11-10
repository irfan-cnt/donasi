import { ChevronDown, Clock, Download, ExternalLink, RefreshCw, TimerOff, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/public/empty-state";
import { FlowLayout } from "@/components/public/flow-layout";
import { CopyField } from "@/components/public/transaction/copy-field";
import { PaymentCountdown } from "@/components/public/transaction/payment-countdown";
import { StatusPoller } from "@/components/public/transaction/status-poller";
import { buttonVariants } from "@/components/ui/button";
import { getEnv } from "@/lib/env";
import { formatRupiah } from "@/lib/money";
import { remainingUntil } from "@/lib/payments/countdown";
import { qrPngDataUrl } from "@/lib/payments/qr";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { tokenQuery, transactionPageInput } from "@/lib/validation/transaction-page";
import { getTransactionView, type TransactionView } from "@/server/services/payment-service";

// Instruksi pembayaran (T-21, F-06, AC-06.x). Hanya dengan kode transaksi + access token sah;
// selain itu 404 (juga di src/proxy.ts). Token di URL → noindex + no-referrer.
// Halaman ini hanya membaca DB; status hanya berubah lewat webhook/getPaymentStatus (BR-18).
export const instant = false;

export const metadata: Metadata = {
  title: `Instruksi Pembayaran — ${SITE_NAME}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InstructionPage({
  params,
  searchParams,
}: PageProps<"/transaksi/[code]/instruksi">) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const parsed = transactionPageInput.safeParse({ code, t: query.t });
  if (!parsed.success) notFound();
  const { t } = parsed.data;
  const view = await getTransactionView(parsed.data.code, t);
  if (!view) notFound();
  const { transaction: trx, payment } = view;
  const qs = tokenQuery(t);
  if (trx.status === "paid") redirect(`/transaksi/${trx.code}/berhasil?${qs}`);

  const payable = trx.status === "created" || trx.status === "pending";
  const selectHref = `/donasi/${trx.campaignSlug}/pembayaran?${new URLSearchParams({ trx: trx.code, t })}`;
  const newPaymentAction = payable ? (
    <Link href={selectHref} prefetch={false} className={buttonVariants({ size: "lg" })}>
      Buat pembayaran baru
    </Link>
  ) : (
    <Link href={`/donasi/${trx.campaignSlug}`} className={buttonVariants({ size: "lg" })}>
      Donasi lagi
    </Link>
  );

  if (!payment || payment.status === "cancelled") {
    return (
      <FlowLayout title="Selesaikan Pembayaran" step={3}>
        <EmptyState
          icon={Clock}
          title="Belum ada pembayaran aktif"
          description="Pilih metode pembayaran untuk melanjutkan donasimu."
          action={newPaymentAction}
        />
      </FlowLayout>
    );
  }
  if (payment.status === "expired") {
    return (
      <FlowLayout title="Selesaikan Pembayaran" step={3}>
        <div data-testid="payment-expired">
          <EmptyState
            icon={TimerOff}
            title="Waktu pembayaran habis"
            description="Pembayaran ini sudah kedaluwarsa dan tidak bisa dibayar lagi. Kamu bisa membuat pembayaran baru untuk donasi yang sama."
            action={newPaymentAction}
          />
        </div>
      </FlowLayout>
    );
  }
  if (payment.status === "failed") {
    return (
      <FlowLayout title="Selesaikan Pembayaran" step={3}>
        <div data-testid="payment-failed">
          <EmptyState
            icon={XCircle}
            title="Pembayaran belum berhasil"
            description="Pembayaran ditolak atau gagal diproses penyedia pembayaran. Silakan coba metode lain."
            action={newPaymentAction}
          />
        </div>
      </FlowLayout>
    );
  }

  const d = payment.details;
  const expiresAt = payment.expiresAt;
  const qr = d?.qrString ? await qrPngDataUrl(d.qrString) : null;
  const amountLabel = formatRupiah(trx.amount);

  return (
    <FlowLayout title="Selesaikan Pembayaran" step={3}>
      <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label="Instruksi pembayaran">
        {expiresAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-warning-soft px-4 py-2.5 text-sm text-warning">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="size-4" aria-hidden />
              Bayar sebelum
            </span>
            <PaymentCountdown
              expiresAt={expiresAt.toISOString()}
              initialLabel={remainingUntil(expiresAt, new Date()).label}
            />
          </div>
        )}
        <div className="p-4">
          <p className="text-sm font-semibold" data-testid="method-name">
            {payment.methodName}
          </p>
          <p className="text-xs text-ink-faint">
            Kode transaksi <span className="font-mono" data-testid="trx-code">{trx.code}</span>
          </p>

          {d?.kind === "virtual_account" && d.vaNumber && (
            <div className="mt-4 space-y-3">
              {d.bankName && (
                <p className="text-sm">
                  Bank tujuan: <strong data-testid="bank-name">{d.bankName}</strong>
                </p>
              )}
              <CopyField label="Nomor Virtual Account" value={d.vaNumber} mono testId="va-number" />
              <CopyField label="Total pembayaran" value={trx.amount.toString()} display={amountLabel} />
              <p className="text-xs text-ink-faint">
                Transfer <strong>tepat</strong> sesuai nominal.
              </p>
            </div>
          )}

          {d?.kind === "payment_code" && d.billKey && (
            <div className="mt-4 space-y-3">
              {d.billerCode && (
                <CopyField label="Kode perusahaan (biller code)" value={d.billerCode} mono testId="biller-code" />
              )}
              <CopyField label="Kode bayar (bill key)" value={d.billKey} mono testId="bill-key" />
              <CopyField label="Total pembayaran" value={trx.amount.toString()} display={amountLabel} />
            </div>
          )}

          {payment.methodType === "qris" && qr && (
            <div className="mt-4 flex flex-col items-center">
              <div className="rounded-2xl border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL buatan sendiri */}
                <img src={qr} alt="Kode QRIS untuk dipindai" width={224} height={224} className="size-56" data-testid="qr-image" />
              </div>
              <p className="mt-3 text-2xl font-bold text-primary-ink tabular-nums">{amountLabel}</p>
              <p className="mt-1 text-center text-xs text-ink-faint">
                Pindai dengan aplikasi m-banking atau e-wallet yang mendukung QRIS
              </p>
              <a
                href={qr}
                download={`QRIS-${trx.code}.png`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
              >
                <Download aria-hidden />
                Unduh QR
              </a>
            </div>
          )}

          {payment.methodType === "ewallet" && (
            <div className="mt-4 text-center">
              <p className="text-2xl font-bold text-primary-ink tabular-nums">{amountLabel}</p>
              <p className="mt-1 text-sm text-ink-faint">Lanjutkan pembayaran di aplikasi {payment.methodName}</p>
              {d?.paymentUrl && (
                <a
                  href={d.paymentUrl}
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}
                  data-testid="deeplink"
                >
                  <ExternalLink aria-hidden />
                  Buka {payment.methodName}
                </a>
              )}
              {qr && (
                <div className="mt-5 hidden flex-col items-center md:flex">
                  <p className="text-sm text-ink-soft">Di komputer? Pindai QR ini dengan aplikasi {payment.methodName}.</p>
                  <div className="mt-3 rounded-2xl border border-border bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL buatan sendiri */}
                    <img src={qr} alt={`Kode QR ${payment.methodName}`} width={192} height={192} className="size-48" />
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-ink-faint">
                Tidak terbuka otomatis? Pastikan aplikasi {payment.methodName} terpasang di HP ini.
              </p>
            </div>
          )}
        </div>
        <div className="border-t border-border bg-muted/50 px-4 py-2.5">
          <StatusPoller code={trx.code} token={t} allowTestHook={getEnv().APP_ENV !== "production"} />
        </div>
      </section>

      <Steps steps={payment.steps} />

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link href={selectHref} prefetch={false} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Ganti metode
        </Link>
        <Link prefetch={false} href={`/transaksi/${trx.code}/menunggu?${qs}`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
          <RefreshCw aria-hidden />
          Saya sudah bayar
        </Link>
      </div>

      <p className="mt-5 rounded-xl bg-primary-soft p-4 text-sm text-primary-ink">
        Halaman ini berpindah sendiri setelah pembayaran terkonfirmasi. Simpan tautan halaman ini untuk
        melanjutkan pembayaran nanti.
      </p>
    </FlowLayout>
  );
}

function Steps({ steps }: { steps: NonNullable<TransactionView["payment"]>["steps"] }) {
  if (!steps.length) return null;
  return (
    <section className="mt-5" aria-labelledby="cara-bayar">
      <h2 id="cara-bayar" className="font-semibold">
        Cara pembayaran
      </h2>
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {steps.map((s, i) => (
          <details key={`${i}-${s.title}`} open={i === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
              {s.title}
              <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-8 text-sm text-ink-soft">
              {s.steps.map((step, j) => (
                <li key={j}>{step}</li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
