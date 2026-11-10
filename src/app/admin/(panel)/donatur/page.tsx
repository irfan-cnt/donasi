import type { Metadata } from "next";
import { Search, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ExportButton } from "@/components/admin/finance/export-button";
import { Pager, Pill } from "@/components/admin/finance/pager";
import { fieldClass } from "@/components/admin/form-bits";
import { formatWibDate, formatWibDateTime } from "@/components/donor/format";
import { TrxStatusBadge } from "@/components/donor/trx-status-badge";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";
import { donorListQuery, FINANCE_PAGE_SIZE } from "@/lib/validation/admin-finance";
import { findAdminDonor, listAdminDonors } from "@/server/repositories/admin-finance-repository";
import { canSeeDonorPii, maskDonorRow, maskTransactionRow } from "@/server/services/admin-finance-service";

export const metadata: Metadata = { title: "Donatur — Admin Tebar Kebaikan" };

const num = new Intl.NumberFormat("id-ID");

// Donatur (F-28): daftar akun/tamu dengan total, jumlah, terakhir; panel detail + riwayat.
// Email/WA dimasking DI SERVER untuk admin tanpa donors.export; ekspor butuh donors.export.
async function Donors({ searchParams }: { searchParams: PageProps<"/admin/donatur">["searchParams"] }) {
  const ctx = await requireAdmin("donors.read");
  const q = donorListQuery.parse(await searchParams);
  const piiVisible = canSeeDonorPii(ctx.permissions);
  const [{ rows, total }, detail] = await Promise.all([listAdminDonors(q, q.hal, !piiVisible), q.id ? findAdminDonor(q.id) : null]);
  const list = rows.map((r) => maskDonorRow(r, !piiVisible));
  const filters = { q: q.q, tipe: q.tipe, urut: q.urut === "total" ? undefined : q.urut };
  const filtered = !!(q.q || q.tipe);
  const keep = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, hal: q.hal > 1 ? String(q.hal) : undefined, ...extra })) if (v) sp.set(k, v);
    return `/admin/donatur?${sp.toString()}`;
  };
  const sel = detail ? { donor: maskDonorRow(detail.donor, !piiVisible), history: detail.history.map((h) => maskTransactionRow(h, !piiVisible)) } : null;

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Donatur</h1>
          <p className="mt-1 text-sm text-ink-faint">Donatur akun Google dan tamu (satu baris per email)</p>
        </div>
        {hasPermission(ctx.permissions, "donors.export") ? <ExportButton kind="donors" filters={{ q: q.q, tipe: q.tipe, urut: q.urut }} label="Ekspor" /> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface">
          <form method="get" className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Filter donatur">
            <div className="relative min-w-0 flex-[1_1_220px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input name="q" defaultValue={q.q ?? ""} placeholder="Nama, email, atau no. WA…" aria-label="Cari donatur" className={cn(fieldClass, "pl-9")} />
            </div>
            <select name="tipe" defaultValue={q.tipe ?? ""} aria-label="Filter tipe" className={cn(fieldClass, "w-auto flex-[1_1_130px]")}>
              <option value="">Semua tipe</option>
              <option value="akun">Akun Google</option>
              <option value="tamu">Tamu</option>
            </select>
            <select name="urut" defaultValue={q.urut} aria-label="Urutkan" className={cn(fieldClass, "w-auto flex-[1_1_150px]")}>
              <option value="total">Urut: total donasi</option>
              <option value="terakhir">Donasi terakhir</option>
              <option value="jumlah">Jumlah transaksi</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" size="lg" variant="secondary">
                Terapkan
              </Button>
              {filtered ? (
                <Link href="/admin/donatur" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
          {list.length === 0 ? (
            <EmptyState icon={Users} title={filtered ? "Tidak ada donatur" : "Belum ada donatur"} description={filtered ? "Coba ubah kata kunci atau filter." : "Donatur muncul setelah transaksi pertama."} />
          ) : (
            <>
              <ul className="divide-y divide-border" data-testid="donor-rows">
                {list.map((x) => (
                  <li key={x.id}>
                    <Link href={keep({ id: x.id })} scroll={false} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/40", q.id === x.id && "bg-primary-soft/40")} aria-current={q.id === x.id ? "true" : undefined}>
                      <div className="min-w-0 flex-[1_1_200px]">
                        <p className="truncate font-medium">{x.anonymized ? "Donatur dianonimkan" : x.name}</p>
                        <p className="truncate text-xs text-ink-faint" data-testid="donor-email">
                          {x.email}
                          {x.phone ? ` · ${x.phone}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatRupiah(x.totalPaid)}</p>
                        <p className="text-xs text-ink-faint">
                          {num.format(x.paidCount)} transaksi · {x.lastPaidAt ? formatWibDate(x.lastPaidAt) : "—"}
                        </p>
                      </div>
                      {x.hasAccount ? <Pill tone="success">Akun</Pill> : <Pill>Tamu</Pill>}
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager basePath="/admin/donatur" params={filters} page={q.hal} total={total} pageSize={FINANCE_PAGE_SIZE} noun="donatur" />
            </>
          )}
        </section>

        <aside className="min-w-0 rounded-2xl border border-border bg-surface p-5" aria-label="Detail donatur" data-testid="donor-detail">
          {!sel ? (
            <p className="text-sm text-ink-faint">{q.id ? "Donatur tidak ditemukan." : "Pilih donatur untuk melihat detail & riwayat."}</p>
          ) : (
            <>
              <p className="font-semibold break-words">{sel.donor.anonymized ? "Donatur dianonimkan" : sel.donor.name}</p>
              <p className="text-sm break-all text-ink-faint">{sel.donor.email}</p>
              <p className="text-sm text-ink-faint">{sel.donor.phone ?? "WA tidak diisi"}</p>
              <p className="mt-1 text-xs text-ink-faint">Terdaftar {formatWibDate(sel.donor.createdAt)}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-xs text-ink-faint">Total</p>
                  <p className="font-bold break-words tabular-nums">{formatRupiah(sel.donor.totalPaid)}</p>
                </div>
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-xs text-ink-faint">Transaksi berhasil</p>
                  <p className="font-bold">{num.format(sel.donor.paidCount)}</p>
                </div>
              </div>
              <h2 className="mt-5 text-sm font-semibold">Riwayat transaksi</h2>
              {sel.history.length === 0 ? (
                <p className="mt-2 text-sm text-ink-faint">Belum ada transaksi.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {sel.history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        {hasPermission(ctx.permissions, "transactions.read") ? (
                          <Link href={`/admin/transaksi/${h.id}`} className="block truncate hover:text-primary">
                            {h.campaignTitle}
                          </Link>
                        ) : (
                          <p className="truncate">{h.campaignTitle}</p>
                        )}
                        <p className="text-xs text-ink-faint">{formatWibDateTime(h.createdAt)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">{formatRupiah(h.amount)}</p>
                        <TrxStatusBadge status={h.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </aside>
      </div>
      {piiVisible ? null : <p className="mt-3 text-xs text-ink-faint">Email & WA disamarkan (butuh izin ekspor donatur). Pencarian email/WA harus memakai nilai lengkap.</p>}
    </>
  );
}

export default function AdminDonorsPage({ searchParams }: PageProps<"/admin/donatur">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Donors searchParams={searchParams} />
    </Suspense>
  );
}
