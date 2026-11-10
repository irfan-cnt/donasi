import { ArrowRight, CheckCircle2, Clock, HandCoins, HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatWibDateTime } from "@/components/donor/format";
import { StatCard } from "@/components/donor/stat-card";
import { TrxList } from "@/components/donor/trx-list";
import { CampaignCard } from "@/components/public/campaign-card";
import { EmptyState } from "@/components/public/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireDonor } from "@/lib/auth";
import { formatRupiah } from "@/lib/money";
import { SITE_NAME } from "@/lib/site";
import { continuePaymentAction } from "@/server/actions/donor-actions";
import { getDonorDashboard, getRecommendedCampaigns } from "@/server/services/donor-account-service";

export const metadata: Metadata = { title: `Akun — ${SITE_NAME}` };

// Dashboard donatur (F-12, AC-12.1). Semua data difilter donorId dari sesi.
export default async function DonorDashboardPage() {
  const donor = await requireDonor("/akun");
  const { summary, recent, payable } = await getDonorDashboard(donor.donorId);
  const recommended = await getRecommendedCampaigns(new Set(recent.map((r) => r.campaignTitle)));

  return (
    <>
      <h1 className="text-xl font-bold text-ink md:text-2xl">Assalamu’alaikum, {donor.name}</h1>
      <p className="mt-1 truncate text-sm text-ink-faint">{donor.email}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total donasi" value={formatRupiah(summary.totalPaid)} icon={HandCoins} testId="stat-total" />
        <StatCard
          label="Donasi berhasil"
          value={summary.paidCount.toLocaleString("id-ID")}
          hint={`${summary.campaignCount.toLocaleString("id-ID")} program`}
          icon={CheckCircle2}
          tone="gold"
          testId="stat-paid"
        />
        <StatCard
          label="Menunggu pembayaran"
          value={summary.pendingCount.toLocaleString("id-ID")}
          hint={payable?.expiresAt ? `Berakhir ${formatWibDateTime(payable.expiresAt)}` : undefined}
          icon={Clock}
          tone="warning"
          testId="stat-pending"
        />
      </div>

      {payable && (
        <Alert className="mt-4 border-warning/40 bg-warning-soft" data-testid="pending-cta">
          <Clock aria-hidden />
          <AlertTitle>
            {summary.pendingCount > 1 ? `${summary.pendingCount} donasi menunggu pembayaran` : "1 donasi menunggu pembayaran"}
          </AlertTitle>
          <AlertDescription>
            <span className="break-words">
              {payable.campaignTitle} — {formatRupiah(payable.amount)}
            </span>
            <form action={continuePaymentAction} className="mt-2">
              <input type="hidden" name="code" value={payable.code} />
              <Button type="submit" size="sm">
                Lanjutkan bayar
              </Button>
            </form>
          </AlertDescription>
        </Alert>
      )}

      <section className="mt-5 rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-semibold text-ink">Donasi terbaru</h2>
          <Link href="/akun/donasi" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Lihat semua
            <ArrowRight aria-hidden />
          </Link>
        </div>
        <div className="p-2 sm:p-3">
          {recent.length ? (
            <TrxList items={recent} />
          ) : (
            <EmptyState
              icon={HeartHandshake}
              title="Belum ada donasi"
              description="Mulai kebaikan pertamamu hari ini. Riwayat dan kuitansi akan tersimpan di sini."
              action={
                <Link href="/campaign" className={buttonVariants()}>
                  Jelajahi program
                </Link>
              }
            />
          )}
        </div>
      </section>

      {recommended.length > 0 && (
        <section className="mt-8" aria-labelledby="rekomendasi">
          <h2 id="rekomendasi" className="font-bold text-ink">
            Mungkin kamu juga peduli
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recommended.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
