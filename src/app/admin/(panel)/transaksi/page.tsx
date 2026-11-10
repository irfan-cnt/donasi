import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Clock, Eye, ReceiptText, Search, TimerOff } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ExportButton } from "@/components/admin/finance/export-button";
import { Pager } from "@/components/admin/finance/pager";
import { fieldClass } from "@/components/admin/form-bits";
import { formatWibDateTime } from "@/components/donor/format";
import { StatCard } from "@/components/donor/stat-card";
import { TrxStatusBadge } from "@/components/donor/trx-status-badge";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";
import { jakartaToday } from "@/lib/validation/admin-dashboard";
import { FINANCE_PAGE_SIZE, transactionListQuery } from "@/lib/validation/admin-finance";
import { listCampaignOptions } from "@/server/repositories/admin-campaign-repository";
import { getTransactionSummary, listAdminTransactions, listMethodOptions } from "@/server/repositories/admin-finance-repository";
import { canSeeDonorPii, maskTransactionRow } from "@/server/services/admin-finance-service";

export const metadata: Metadata = { title: "Transaksi — Admin Tebar Kebaikan" };

const num = new Intl.NumberFormat("id-ID");
const STATUS_OPTIONS = [
  ["paid", "Berhasil"],
  ["pending", "Menunggu"],
  ["created", "Dibuat"],
  ["expired", "Kedaluwarsa"],
  ["failed", "Gagal"],
  ["cancelled", "Dibatalkan"],
  ["refunded", "Dikembalikan"],
] as const;

// Transaksi (F-27): filter status/tanggal/campaign/metode, cari kode/nama/email/WA, ringkasan,
// ekspor CSV sesuai filter. Tidak ada aksi "tandai lunas" (AC-27.1).
async function Transactions({ searchParams }: { searchParams: PageProps<"/admin/transaksi">["searchParams"] }) {
  const ctx = await requireAdmin("transactions.read");
  const q = transactionListQuery.parse(await searchParams);
  const piiVisible = canSeeDonorPii(ctx.permissions);
  const [{ rows, total }, summary, campaigns, methods] = await Promise.all([
    listAdminTransactions(q, q.hal, !piiVisible),
    getTransactionSummary(jakartaToday(new Date())),
    listCampaignOptions(),
    listMethodOptions(),
  ]);
  const list = rows.map((r) => maskTransactionRow(r, !piiVisible));
  const filters = { q: q.q, status: q.status, campaign: q.campaign, metode: q.metode, dari: q.dari, sampai: q.sampai };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Transaksi</h1>
          <p className="mt-1 text-sm text-ink-faint">Status hanya berubah dari webhook terverifikasi atau cek status ke Midtrans</p>
        </div>
        {hasPermission(ctx.permissions, "transactions.export") ? <ExportButton kind="transactions" filters={filters} /> : null}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Berhasil (hari ini)" value={formatRupiah(summary.paidTodayAmount)} hint={`${num.format(summary.paidTodayCount)} transaksi`} icon={CheckCircle2} testId="sum-paid" />
        <StatCard label="Menunggu" value={num.format(summary.pendingCount)} hint={formatRupiah(summary.pendingAmount)} icon={Clock} tone="warning" />
        <StatCard label="Kedaluwarsa (7 hari)" value={num.format(summary.expired7d)} icon={TimerOff} tone="gold" />
        <StatCard label="Perlu ditinjau (7 hari)" value={num.format(summary.review7d)} hint="anomali & rekonsiliasi" icon={AlertTriangle} tone="warning" />
      </div>

      <section className="min-w-0 rounded-2xl border border-border bg-surface">
        <form method="get" className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Filter transaksi">
          <div className="relative min-w-0 flex-[1_1_240px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input name="q" defaultValue={q.q ?? ""} placeholder="Kode, nama, email, atau no. WA…" aria-label="Cari transaksi" className={cn(fieldClass, "pl-9")} />
          </div>
          <select name="status" defaultValue={q.status ?? ""} aria-label="Filter status" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
            <option value="">Semua status</option>
            {STATUS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select name="campaign" defaultValue={q.campaign ?? ""} aria-label="Filter campaign" className={cn(fieldClass, "w-auto min-w-0 flex-[1_1_180px]")}>
            <option value="">Semua campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select name="metode" defaultValue={q.metode ?? ""} aria-label="Filter metode" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
            <option value="">Semua metode</option>
            {methods.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
          <input type="date" name="dari" defaultValue={q.dari ?? ""} aria-label="Dari tanggal" className={cn(fieldClass, "w-auto flex-[1_1_140px]")} />
          <input type="date" name="sampai" defaultValue={q.sampai ?? ""} aria-label="Sampai tanggal" className={cn(fieldClass, "w-auto flex-[1_1_140px]")} />
          <div className="flex gap-2">
            <Button type="submit" size="lg" variant="secondary">
              Terapkan
            </Button>
            {filtered ? (
              <Link href="/admin/transaksi" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                Reset
              </Link>
            ) : null}
          </div>
        </form>

        {list.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Tidak ada transaksi" description={filtered ? "Coba ubah filter atau rentang tanggal." : "Transaksi akan muncul setelah donatur berdonasi."} />
        ) : (
          <>
            <ul className="divide-y divide-border md:hidden" data-testid="trx-rows-mobile">
              {list.map((t) => (
                <li key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/admin/transaksi/${t.id}`} className="font-mono text-xs font-semibold text-ink hover:text-primary">
                      {t.code}
                    </Link>
                    <TrxStatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {t.donorName}
                    {t.isAnonymous ? " *" : ""}
                  </p>
                  <p className="truncate text-xs text-ink-faint">{t.campaignTitle}</p>
                  <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
                    <span className="font-semibold tabular-nums">{formatRupiah(t.amount)}</span>
                    <span className="text-ink-faint">{formatWibDateTime(t.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm" data-testid="trx-table">
                <thead className="bg-muted/60 text-left text-xs text-ink-faint">
                  <tr>
                    {["Kode", "Donatur", "Campaign", "Nominal", "Metode", "Status", "Dibuat", ""].map((h, i) => (
                      <th key={i} scope="col" className="px-4 py-2.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{t.code}</td>
                      <td className="px-4 py-3">
                        <p className="max-w-[200px] truncate font-medium">
                          {t.donorName}
                          {t.isAnonymous ? " *" : ""}
                        </p>
                        <p className="max-w-[200px] truncate text-xs text-ink-faint">{t.donorEmail}</p>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3">{t.campaignTitle}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums">{formatRupiah(t.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{t.methodName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <TrxStatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-faint">{formatWibDateTime(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/transaksi/${t.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Detail ${t.code}`}>
                          <Eye aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager basePath="/admin/transaksi" params={filters} page={q.hal} total={total} pageSize={FINANCE_PAGE_SIZE} noun="transaksi" />
          </>
        )}
      </section>
      <p className="mt-3 text-xs text-ink-faint">
        * Donatur memilih tampil sebagai Hamba Allah. Nama asli hanya terlihat oleh admin.
        {piiVisible ? "" : " Email & WA disamarkan; pencarian email/WA harus memakai nilai lengkap."}
      </p>
    </>
  );
}

export default function AdminTransactionsPage({ searchParams }: PageProps<"/admin/transaksi">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Transactions searchParams={searchParams} />
    </Suspense>
  );
}
