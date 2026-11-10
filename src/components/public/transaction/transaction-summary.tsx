import { formatRupiah } from "@/lib/money";
import type { TransactionView } from "@/server/services/payment-service";

const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatWib(date: Date): string {
  return `${dateTime.format(date)} WIB`;
}

/** Ringkasan transaksi untuk halaman berhasil/menunggu (tanpa data donatur). */
export function TransactionSummary({ view }: { view: TransactionView }) {
  const { transaction: trx, payment } = view;
  const rows: [string, string][] = [
    ["Kode transaksi", trx.code],
    ["Program", trx.campaignTitle],
  ];
  if (payment) rows.push(["Metode", payment.methodName]);
  rows.push(trx.paidAt ? ["Dibayar", formatWib(trx.paidAt)] : ["Dibuat", formatWib(trx.createdAt)]);
  return (
    <section
      className="mt-6 rounded-xl border border-border bg-surface p-4 text-left"
      aria-label="Ringkasan transaksi"
    >
      <dl className="space-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="shrink-0 text-ink-faint">{k}</dt>
            <dd className="min-w-0 text-right font-medium break-words" data-testid={k === "Kode transaksi" ? "trx-code" : undefined}>
              {v}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-dashed border-border pt-2.5">
          <dt className="font-semibold">Nominal</dt>
          <dd className="text-lg font-bold text-primary-ink tabular-nums">{formatRupiah(trx.amount)}</dd>
        </div>
      </dl>
    </section>
  );
}
