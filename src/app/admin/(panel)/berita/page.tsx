import type { Metadata } from "next";
import { Newspaper, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { fieldClass } from "@/components/admin/form-bits";
import { NewsEditor } from "@/components/admin/news-editor";
import { formatWibDate } from "@/components/donor/format";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { cn } from "@/lib/utils";
import { adminNewsListQuery, CAMPAIGN_PAGE_SIZE } from "@/lib/validation/admin-campaign";
import { findNewsById, listAdminNews, listCampaignOptions } from "@/server/repositories/admin-campaign-repository";

export const metadata: Metadata = { title: "Berita — Admin Tebar Kebaikan" };

const num = new Intl.NumberFormat("id-ID");

function StatusPill({ status }: { status: "draft" | "published" }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold", status === "published" ? "bg-success-soft text-success" : "bg-muted text-ink-soft")}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status === "published" ? "Terbit" : "Draf"}
    </span>
  );
}

// Berita campaign (F-25): daftar + editor panel samping (mockup AdminNewsPage).
async function NewsAdmin({ searchParams }: { searchParams: PageProps<"/admin/berita">["searchParams"] }) {
  const ctx = await requireAdmin("news.write");
  const canPublish = hasPermission(ctx.permissions, "news.publish");
  const q = adminNewsListQuery.parse(await searchParams);
  const [{ rows, total }, campaigns, editing] = await Promise.all([
    listAdminNews(q),
    listCampaignOptions(),
    q.edit ? findNewsById(q.edit) : Promise.resolve(undefined),
  ]);
  const showEditor = !!editing || q.tulis !== undefined;
  const pages = Math.max(1, Math.ceil(total / CAMPAIGN_PAGE_SIZE));
  const filtered = !!(q.q || q.status || (q.campaign && q.tulis === undefined));

  const base = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (q.q) p.set("q", q.q);
    if (q.campaign) p.set("campaign", q.campaign);
    if (q.status) p.set("status", q.status);
    for (const [k, val] of Object.entries(extra)) if (val) p.set(k, val);
    const s = p.toString();
    return s ? `/admin/berita?${s}` : "/admin/berita";
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Berita</h1>
          <p className="mt-1 text-sm text-ink-faint">Kabar perkembangan & penyaluran per campaign</p>
        </div>
        <Link href={base({ tulis: "1" })} className={buttonVariants({ size: "lg" })}>
          <Plus aria-hidden />
          Tulis Berita
        </Link>
      </div>

      <div className={cn("grid min-w-0 gap-5", showEditor && "xl:grid-cols-[minmax(0,1fr)_460px]")}>
        {showEditor ? (
          <div className="min-w-0 xl:order-2">
            <NewsEditor
              key={editing?.id ?? "baru"}
              newsId={editing?.id ?? null}
              status={editing?.status ?? "draft"}
              canPublish={canPublish}
              campaigns={campaigns}
              closeHref={base({})}
              initial={{
                campaignId: editing?.campaignId ?? q.campaign ?? "",
                title: editing?.title ?? "",
                slug: editing?.slug ?? "",
                excerpt: editing?.excerpt ?? "",
                contentHtml: editing?.contentHtml ?? "",
                featuredImageUrl: editing?.featuredImageUrl ?? null,
                featuredImageAlt: editing?.featuredImageAlt ?? "",
                seoTitle: editing?.seoTitle ?? "",
                seoDescription: editing?.seoDescription ?? "",
              }}
            />
          </div>
        ) : null}
        <section className="min-w-0 rounded-2xl border border-border bg-surface xl:order-1">
          <form method="get" className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Filter berita">
            <div className="relative min-w-0 flex-[1_1_200px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input name="q" defaultValue={q.q ?? ""} placeholder="Cari judul berita…" aria-label="Cari judul berita" className={cn(fieldClass, "pl-9")} />
            </div>
            <select name="campaign" defaultValue={q.campaign ?? ""} aria-label="Filter campaign" className={cn(fieldClass, "w-auto min-w-0 flex-[1_1_160px]")}>
              <option value="">Semua campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title.slice(0, 50)}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={q.status ?? ""} aria-label="Filter status" className={cn(fieldClass, "w-auto flex-[1_1_120px]")}>
              <option value="">Semua status</option>
              <option value="published">Terbit</option>
              <option value="draft">Draf</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" size="lg" variant="secondary">
                Terapkan
              </Button>
              {filtered ? (
                <Link href="/admin/berita" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
          {rows.length === 0 ? (
            <EmptyState icon={Newspaper} title="Belum ada berita" description="Laporkan perkembangan program agar donatur makin percaya." />
          ) : (
            <>
              <ul className="divide-y divide-border" data-testid="news-rows">
                {rows.map((n) => (
                  <li key={n.id} className={cn("flex items-center gap-3 px-4 py-3", editing?.id === n.id && "bg-primary-soft/50")}>
                    <div className="min-w-0 flex-1">
                      <Link href={base({ edit: n.id })} className="block truncate font-medium text-ink hover:text-primary">
                        {n.title}
                      </Link>
                      <p className="truncate text-xs text-ink-faint">{n.campaignTitle}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill status={n.status} />
                      <span className="text-xs whitespace-nowrap text-ink-faint">{n.publishedAt ? formatWibDate(n.publishedAt) : "—"}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4 text-sm" aria-label="Paginasi">
                <span className="text-ink-faint">
                  {num.format(total)} berita · halaman {q.hal} dari {pages}
                </span>
                <div className="flex gap-2">
                  <Link href={base({ hal: String(q.hal - 1) })} aria-disabled={q.hal <= 1} tabIndex={q.hal <= 1 ? -1 : undefined} className={cn(buttonVariants({ variant: "outline", size: "sm" }), q.hal <= 1 && "pointer-events-none opacity-50")}>
                    Sebelumnya
                  </Link>
                  <Link href={base({ hal: String(q.hal + 1) })} aria-disabled={q.hal >= pages} tabIndex={q.hal >= pages ? -1 : undefined} className={cn(buttonVariants({ variant: "outline", size: "sm" }), q.hal >= pages && "pointer-events-none opacity-50")}>
                    Berikutnya
                  </Link>
                </div>
              </nav>
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default function AdminNewsPage({ searchParams }: PageProps<"/admin/berita">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <NewsAdmin searchParams={searchParams} />
    </Suspense>
  );
}
