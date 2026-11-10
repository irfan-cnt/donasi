import type { Metadata } from "next";
import { Megaphone, Plus, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CampaignStatusBadge } from "@/components/admin/campaign-status-badge";
import { fieldClass } from "@/components/admin/form-bits";
import { formatWibDate } from "@/components/donor/format";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { CAMPAIGN_STATUS_LABEL, type CampaignStatusCode } from "@/lib/campaign-rules";
import { formatRupiah, progressPercent } from "@/lib/money";
import { cn } from "@/lib/utils";
import { adminCampaignListQuery, CAMPAIGN_PAGE_SIZE } from "@/lib/validation/admin-campaign";
import { listAdminCampaigns, listCategoryOptions } from "@/server/repositories/admin-campaign-repository";

export const metadata: Metadata = { title: "Campaign — Admin Tebar Kebaikan" };

const num = new Intl.NumberFormat("id-ID");

function Thumb({ url, title }: { url: string | null; title: string }) {
  return (
    <span className="relative block h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
      {url ? <Image src={url} alt="" fill sizes="56px" className="object-cover" unoptimized={url.endsWith(".svg")} /> : <span className="sr-only">{title}</span>}
    </span>
  );
}

// Daftar campaign (F-24): filter status/kategori/tipe nominal, cari judul (trigram), paginasi.
async function CampaignList({ searchParams }: { searchParams: PageProps<"/admin/campaign">["searchParams"] }) {
  const ctx = await requireAdmin("campaigns.read");
  const q = adminCampaignListQuery.parse(await searchParams);
  const [{ rows, total }, categories] = await Promise.all([listAdminCampaigns(q), listCategoryOptions()]);
  const canWrite = hasPermission(ctx.permissions, "campaigns.write");
  const pages = Math.max(1, Math.ceil(total / CAMPAIGN_PAGE_SIZE));
  const filtered = !!(q.q || q.status || q.kategori || q.tipe);

  const href = (page: number) => {
    const p = new URLSearchParams();
    if (q.q) p.set("q", q.q);
    if (q.status) p.set("status", q.status);
    if (q.kategori) p.set("kategori", q.kategori);
    if (q.tipe) p.set("tipe", q.tipe);
    if (page > 1) p.set("hal", String(page));
    const s = p.toString();
    return s ? `/admin/campaign?${s}` : "/admin/campaign";
  };
  const now = new Date();
  const days = (end: Date | null) => {
    if (!end) return "—";
    const d = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
    return d <= 0 ? "Berakhir" : `${d} hari lagi`;
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Campaign</h1>
          <p className="mt-1 text-sm text-ink-faint">Kelola program donasi, nominal, dan status tayang</p>
        </div>
        {canWrite ? (
          <Link href="/admin/campaign/baru" className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            Campaign Baru
          </Link>
        ) : null}
      </div>

      <section className="min-w-0 rounded-2xl border border-border bg-surface">
        <form method="get" className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Filter campaign">
          <div className="relative min-w-0 flex-[1_1_220px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input name="q" defaultValue={q.q ?? ""} placeholder="Cari judul campaign…" aria-label="Cari judul campaign" className={cn(fieldClass, "pl-9")} />
          </div>
          <select name="status" defaultValue={q.status ?? ""} aria-label="Filter status" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
            <option value="">Semua status</option>
            {(Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatusCode[]).map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select name="kategori" defaultValue={q.kategori ?? ""} aria-label="Filter kategori" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="tipe" defaultValue={q.tipe ?? ""} aria-label="Filter tipe nominal" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
            <option value="">Tipe nominal: semua</option>
            <option value="open">Open amount</option>
            <option value="fixed">Fixed amount</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="lg" variant="secondary">
              Terapkan
            </Button>
            {filtered ? (
              <Link href="/admin/campaign" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                Reset
              </Link>
            ) : null}
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={filtered ? "Tidak ada campaign" : "Belum ada campaign"}
            description={filtered ? "Tidak ada campaign dengan filter ini." : "Buat campaign pertama untuk mulai menerima donasi."}
          />
        ) : (
          <>
            {/* Mobile: kartu */}
            <ul className="divide-y divide-border md:hidden" data-testid="campaign-rows-mobile">
              {rows.map((c) => (
                <li key={c.id} className="flex gap-3 p-4">
                  <Thumb url={c.featuredImageUrl} title={c.title} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/campaign/${c.id}`} className="line-clamp-2 font-semibold text-ink hover:text-primary">
                      {c.title}
                    </Link>
                    <p className="truncate text-xs text-ink-faint">
                      {c.categoryName} · /{c.slug}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <CampaignStatusBadge status={c.status} />
                      <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{c.amountType === "open" ? "Open" : "Fixed"}</span>
                      <span className="font-semibold tabular-nums">{formatRupiah(c.collectedAmount)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop: tabel */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm" data-testid="campaign-table">
                <thead className="bg-muted/60 text-left text-xs text-ink-faint">
                  <tr>
                    {["Campaign", "Status", "Nominal", "Terkumpul", "Donatur", "Berakhir"].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb url={c.featuredImageUrl} title={c.title} />
                          <div className="min-w-0">
                            <Link href={`/admin/campaign/${c.id}`} className="block max-w-[320px] truncate font-semibold hover:text-primary">
                              {c.title}
                            </Link>
                            <p className="max-w-[320px] truncate text-xs text-ink-faint">
                              {c.categoryName} · /{c.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CampaignStatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", c.amountType === "open" ? "bg-primary-soft text-primary-ink" : "bg-gold-soft text-ink")}>
                          {c.amountType === "open" ? "Open" : "Fixed"}
                        </span>
                      </td>
                      <td className="min-w-[160px] px-4 py-3">
                        <p className="font-semibold tabular-nums">{formatRupiah(c.collectedAmount)}</p>
                        {c.targetAmount ? (
                          <div className="mt-1 h-1 rounded-full bg-muted" aria-hidden>
                            <div className="h-1 rounded-full bg-primary" style={{ width: `${progressPercent(c.collectedAmount, c.targetAmount)}%` }} />
                          </div>
                        ) : (
                          <p className="text-xs text-ink-faint">tanpa target</p>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{num.format(c.donorCount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-faint" title={c.endAt ? formatWibDate(c.endAt) : undefined}>
                        {days(c.endAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4 text-sm" aria-label="Paginasi">
              <span className="text-ink-faint">
                {num.format(total)} campaign · halaman {q.hal} dari {pages}
              </span>
              <div className="flex gap-2">
                <Link href={href(q.hal - 1)} aria-disabled={q.hal <= 1} tabIndex={q.hal <= 1 ? -1 : undefined} className={cn(buttonVariants({ variant: "outline", size: "sm" }), q.hal <= 1 && "pointer-events-none opacity-50")}>
                  Sebelumnya
                </Link>
                <Link href={href(q.hal + 1)} aria-disabled={q.hal >= pages} tabIndex={q.hal >= pages ? -1 : undefined} className={cn(buttonVariants({ variant: "outline", size: "sm" }), q.hal >= pages && "pointer-events-none opacity-50")}>
                  Berikutnya
                </Link>
              </div>
            </nav>
          </>
        )}
      </section>
    </>
  );
}

export default function AdminCampaignsPage({ searchParams }: PageProps<"/admin/campaign">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <CampaignList searchParams={searchParams} />
    </Suspense>
  );
}
