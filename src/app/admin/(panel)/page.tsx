import type { Metadata } from "next";
import { ArrowUpRight, CheckCircle2, Clock, HandCoins, Megaphone, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DailyDonationChart } from "@/components/admin/daily-donation-chart";
import { DashboardFilter } from "@/components/admin/dashboard-filter";
import { formatWibDateTime } from "@/components/donor/format";
import { StatCard } from "@/components/donor/stat-card";
import { TrxStatusBadge } from "@/components/donor/trx-status-badge";
import { requireAdmin } from "@/lib/admin-auth";
import { formatRupiah, progressPercent } from "@/lib/money";
import { jakartaToday, resolveDashboardRange } from "@/lib/validation/admin-dashboard";
import { getAdminDashboard } from "@/server/services/admin-dashboard-service";

export const metadata: Metadata = { title: "Dashboard — Admin Tebar Kebaikan" };

const num = new Intl.NumberFormat("id-ID");
const dayLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const asDay = (iso: string) => new Date(`${iso}T00:00:00Z`);

function changeHint(cur: bigint, prev: bigint): string {
  if (prev === 0n) return cur === 0n ? "Sama dengan periode lalu" : "Naik dari Rp0 periode lalu";
  const bp = ((cur - prev) * 1000n) / prev; // per mil, presisi bigint
  const pct = (Number(bp < 0n ? -bp : bp) / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return `${bp < 0n ? "▼" : "▲"} ${pct}% vs periode lalu`;
}

function Section({
  title,
  description,
  action,
  children,
  testId,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface" data-testid={testId}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-faint">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const ctx = await requireAdmin();
  const now = new Date();
  const range = resolveDashboardRange(await searchParams, now);
  const data = await getAdminDashboard(ctx.permissions, range);
  const trx = data.transactions;
  const camp = data.campaigns;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-faint" data-testid="dashboard-range">
            {fullDay.format(asDay(range.from))} – {fullDay.format(asDay(range.to))} ({range.days} hari) · data per{" "}
            {formatWibDateTime(now)}
          </p>
        </div>
        {trx ? <DashboardFilter range={range} today={jakartaToday(now)} /> : null}
      </div>

      {!trx && !camp ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-soft">
          Assalamu&apos;alaikum, {ctx.name}. Belum ada widget dashboard untuk peran Anda.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" data-testid="kpis">
        {trx ? (
          <>
            <StatCard
              label="Total donasi"
              value={formatRupiah(trx.kpis.paidAmount)}
              hint={changeHint(trx.kpis.paidAmount, trx.kpis.prevPaidAmount)}
              icon={HandCoins}
              testId="kpi-paid-amount"
            />
            <StatCard
              label="Transaksi sukses"
              value={num.format(trx.kpis.paidCount)}
              icon={CheckCircle2}
              tone="gold"
              testId="kpi-paid-count"
            />
            <StatCard
              label="Menunggu bayar"
              value={num.format(trx.kpis.pendingCount)}
              hint={`${formatRupiah(trx.kpis.pendingAmount)} potensial`}
              icon={Clock}
              tone="warning"
              testId="kpi-pending"
            />
            <StatCard
              label="Total donatur"
              value={num.format(trx.kpis.donorCount)}
              hint="Donatur unik dengan donasi berhasil"
              icon={Users}
              testId="kpi-donors"
            />
          </>
        ) : null}
        {camp ? (
          <StatCard
            label="Campaign aktif"
            value={num.format(camp.counts.active)}
            hint={`${num.format(camp.counts.paused)} dijeda`}
            icon={Megaphone}
            testId="kpi-active-campaigns"
          />
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        {trx ? (
          <Section
            title="Donasi harian"
            description="Nominal transaksi berhasil per hari (WIB)"
            action={<span className="shrink-0 text-sm font-semibold tabular-nums">{formatRupiah(trx.kpis.paidAmount)}</span>}
            testId="daily-chart"
          >
            <div className="p-5">
              {trx.kpis.paidCount === 0 ? (
                <p className="py-10 text-center text-sm text-ink-faint">Belum ada donasi pada periode ini.</p>
              ) : (
                <DailyDonationChart
                  data={trx.daily.map((d) => ({
                    label: dayLabel.format(asDay(d.day)),
                    value: Number(d.amount),
                    amountText: formatRupiah(d.amount),
                    count: d.count,
                  }))}
                />
              )}
            </div>
          </Section>
        ) : null}
        {camp ? (
          <Section
            title="Performa campaign"
            description="Campaign aktif — terkumpul vs target"
            action={
              <Link href="/admin/campaign" className="shrink-0 text-sm font-medium text-primary hover:underline">
                Semua
              </Link>
            }
            testId="campaign-performance"
          >
            {camp.top.length === 0 ? (
              <p className="p-5 text-sm text-ink-faint">Belum ada campaign aktif.</p>
            ) : (
              <ul className="space-y-4 p-5">
                {camp.top.map((c) => {
                  const pct = c.target ? progressPercent(c.collected, c.target) : 100;
                  return (
                    <li key={c.id}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-ink">{c.title}</span>
                        <span className="shrink-0 text-ink-faint tabular-nums">{c.target ? `${pct}%` : "—"}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={c.target ? "h-full bg-primary" : "h-full bg-brand-orange"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink-faint tabular-nums">
                        {formatRupiah(c.collected)}
                        {c.target ? ` / ${formatRupiah(c.target)}` : " · tanpa target"} · {num.format(c.donorCount)}{" "}
                        donatur
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        ) : null}
      </div>

      {trx ? (
        <div className="mt-5">
          <Section
            title="Transaksi terbaru"
            action={
              <Link
                href="/admin/transaksi"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Lihat semua
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            }
            testId="latest-transactions"
          >
            {trx.latest.length === 0 ? (
              <p className="p-5 text-sm text-ink-faint">Belum ada transaksi pada periode ini.</p>
            ) : (
              <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel transaksi terbaru">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/60 text-xs tracking-wide text-ink-faint uppercase">
                      {["Kode", "Donatur", "Campaign", "Nominal", "Metode", "Status", "Waktu"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trx.latest.map((t) => (
                      <tr key={t.code}>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{t.code}</td>
                        <td className="max-w-[160px] truncate px-4 py-3">{t.donorName}</td>
                        <td className="max-w-[220px] truncate px-4 py-3">{t.campaignTitle}</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap tabular-nums">{formatRupiah(t.amount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{t.methodName ?? "—"}</td>
                        <td className="px-4 py-3">
                          <TrxStatusBadge status={t.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-ink-faint">{formatWibDateTime(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      ) : null}
    </>
  );
}

export default function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
