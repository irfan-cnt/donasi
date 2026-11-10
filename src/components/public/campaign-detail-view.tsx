import { BadgeCheck, CalendarDays, ChevronDown, ChevronRight, Info, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatDateJakarta } from "@/lib/format/relative-time";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CampaignDetail, PublicCampaignStatus } from "@/server/queries/public-campaign-detail";
import { DaysLabel } from "./campaign-card";
import { FundProgress } from "./fund-progress";
import { ReadMore } from "./read-more";
import { ShareButton } from "./share-button";

const countFormatter = new Intl.NumberFormat("id-ID");

/** Alasan CTA nonaktif (AC-02.2); null = boleh donasi. */
export function donateBlockReason(status: PublicCampaignStatus): string | null {
  if (status === "published") return null;
  if (status === "paused") return "Donasi dijeda";
  if (status === "completed") return "Program selesai";
  return "Belum dibuka";
}

/** Rute checkout (P08: /donasi/[slug]). */
export const donateHref = (slug: string) => `/donasi/${slug}`;

export function DonateButton({
  slug,
  status,
  className,
  label = "Donasi Sekarang",
}: {
  slug: string;
  status: PublicCampaignStatus;
  className?: string;
  label?: string;
}) {
  const reason = donateBlockReason(status);
  const cls = cn(buttonVariants({ size: "lg" }), "h-11 w-full text-base", className);
  if (reason) {
    return (
      <button type="button" disabled className={cls}>
        {reason}
      </button>
    );
  }
  return (
    <Link href={donateHref(slug)} className={cls}>
      {label}
      <ChevronRight className="size-5" aria-hidden />
    </Link>
  );
}

function Gallery({ c }: { c: CampaignDetail }) {
  const [main, ...rest] = c.images;
  if (!main) return null;
  const unopt = (url: string) => url.endsWith(".svg");
  return (
    <div>
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-primary-soft md:rounded-2xl">
        <Image
          src={main.url}
          alt={main.alt}
          fill
          priority
          sizes="(min-width: 1024px) 720px, 100vw"
          unoptimized={unopt(main.url)}
          className="object-cover"
        />
      </div>
      {rest.length > 0 ? (
        <ul className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 md:px-0" aria-label="Galeri">
          {rest.map((img) => (
            <li key={img.url} className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={img.url}
                alt={img.alt}
                fill
                sizes="80px"
                unoptimized={unopt(img.url)}
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusNotice({ status }: { status: PublicCampaignStatus }) {
  if (status === "published") return null;
  const paused = status === "paused";
  return (
    <div
      role="status"
      className={cn(
        "mt-4 rounded-xl border px-4 py-3 text-sm",
        paused ? "border-warning/30 bg-warning-soft" : "border-info/30 bg-info-soft",
      )}
    >
      <p className="font-semibold text-ink">
        {paused
          ? "Donasi sementara dijeda"
          : status === "completed"
            ? "Program telah selesai"
            : "Pratinjau — program belum dipublikasikan"}
      </p>
      <p className="mt-0.5 text-ink-soft">
        {paused
          ? "Pengelola sedang memperbarui informasi program. Silakan kembali beberapa saat lagi."
          : status === "completed"
            ? "Terima kasih kepada seluruh donatur. Lihat laporan penyaluran di bawah."
            : "Halaman ini hanya dapat dilihat lewat tautan pratinjau admin."}
      </p>
    </div>
  );
}

function FundUsage({ c }: { c: CampaignDetail }) {
  const d = c.disbursements;
  const rows: [string, bigint][] = [
    ["Disalurkan ke program", d.program],
    ["Biaya operasional", d.operational],
    ["Biaya transaksi bank/gateway", d.bankFee],
  ];
  const available = c.collectedAmount - d.total;
  return (
    <section className="mt-6" aria-labelledby="rincian-dana">
      <details open className="group rounded-2xl border border-border bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <h2 id="rincian-dana" className="font-bold">
            Rincian penggunaan dana
          </h2>
          <ChevronDown className="size-5 transition group-open:rotate-180" aria-hidden />
        </summary>
        <dl className="space-y-2.5 border-t border-border px-5 py-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Dana terkumpul</dt>
            <dd className="tabular font-medium">{formatRupiah(c.collectedAmount)}</dd>
          </div>
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="tabular font-medium">
                {value > 0n ? "− " : ""}
                {formatRupiah(value)}
              </dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-dashed border-border pt-2.5 font-bold">
            <dt>Dana tersedia</dt>
            <dd className="tabular text-primary-ink">
              {formatRupiah(available > 0n ? available : 0n)}
            </dd>
          </div>
          <p className="flex gap-1.5 pt-1 text-xs text-ink-faint">
            <Info className="size-3.5 shrink-0" aria-hidden />
            {d.count === 0
              ? "Belum ada penyaluran tercatat. Rincian diperbarui setiap ada penyaluran."
              : "Diperbarui setiap ada penyaluran. Bukti penyaluran tersedia di kabar terbaru."}
          </p>
        </dl>
      </details>
    </section>
  );
}

export function CampaignDetailView({ c }: { c: CampaignDetail }) {
  const base = `/campaign/${c.slug}`;
  return (
    <>
      <div className="mx-auto max-w-6xl px-0 md:px-4 md:pt-6">
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <Gallery c={c} />
            <div className="px-4 md:px-0">
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href={`/campaign?kategori=${c.categorySlug}`}
                  className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-ink"
                >
                  {c.categoryName}
                </Link>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                  <BadgeCheck className="size-3.5 text-primary" aria-hidden />
                  Terverifikasi
                </span>
              </div>
              <h1 className="mt-3 font-display text-2xl leading-tight font-bold break-words md:text-3xl">
                {c.title}
              </h1>

              <div className="mt-5 rounded-2xl border border-border bg-surface p-4 shadow-card md:hidden">
                <FundProgress collected={c.collectedAmount} target={c.targetAmount} size="lg" />
                <div className="mt-3 flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-ink-faint">
                    <Users className="size-4" aria-hidden />
                    {countFormatter.format(c.donorCount)} donasi
                  </span>
                  <DaysLabel c={{ status: c.status === "completed" ? "completed" : "published", daysLeft: c.daysLeft }} />
                </div>
              </div>

              <StatusNotice status={c.status} />

              <section className="mt-6" aria-labelledby="tentang">
                <h2 id="tentang" className="text-lg font-bold">
                  Tentang program
                </h2>
                <ReadMore id="deskripsi-program">
                  <div
                    className="prose-tk break-words"
                    // HTML sudah disanitasi di server (sanitizeRichText, whitelist).
                    dangerouslySetInnerHTML={{ __html: c.descriptionHtml }}
                  />
                </ReadMore>
              </section>

              <FundUsage c={c} />

              <section className="mt-8" aria-labelledby="kabar">
                <div className="flex items-center justify-between">
                  <h2 id="kabar" className="text-lg font-bold">
                    Kabar terbaru
                  </h2>
                  <span className="text-sm text-ink-faint">{c.newsCount} kabar</span>
                </div>
                {c.news.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-faint">Belum ada kabar terbaru dari program ini.</p>
                ) : (
                  <ol className="relative mt-4 space-y-5 border-l-2 border-primary-soft pl-5">
                    {c.news.map((n) => (
                      <li key={n.slug} className="relative">
                        <span className="absolute top-1 -left-[27px] size-3 rounded-full border-2 border-surface bg-primary" />
                        <p className="flex items-center gap-1 text-xs text-ink-faint">
                          <CalendarDays className="size-3.5" aria-hidden />
                          <time dateTime={n.publishedAt.toISOString()}>{formatDateJakarta(n.publishedAt)}</time>
                        </p>
                        <Link
                          href={`${base}/berita/${n.slug}`}
                          className="mt-1 block leading-snug font-semibold break-words hover:text-primary"
                        >
                          {n.title}
                        </Link>
                        {n.excerpt ? (
                          <p className="mt-1 line-clamp-2 text-sm text-ink-faint">{n.excerpt}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="mt-8" aria-labelledby="donatur">
                <div className="flex items-center justify-between">
                  <h2 id="donatur" className="text-lg font-bold">
                    Donatur &amp; doa
                  </h2>
                  <span className="text-sm text-ink-faint">{countFormatter.format(c.donorCount)} donasi</span>
                </div>
                {c.donations.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-faint">Jadilah donatur pertama program ini.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border" data-testid="donatur-list">
                    {c.donations.map((d, i) => (
                      <li key={i} className="flex gap-3 py-3">
                        <span
                          aria-hidden
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink"
                        >
                          {d.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                            <p className="truncate text-sm font-semibold">{d.name}</p>
                            <p className="text-xs text-ink-faint">{d.timeLabel}</p>
                          </div>
                          <p className="tabular text-xs text-ink-soft">
                            Berdonasi {formatRupiah(d.amount)}
                          </p>
                          {d.prayer ? (
                            <p className="mt-1 text-sm break-words text-ink-soft italic">“{d.prayer}”</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>

          <aside className="hidden md:block">
            <div className="sticky top-24 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <FundProgress collected={c.collectedAmount} target={c.targetAmount} size="lg" />
              <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                <div className="rounded-xl bg-muted py-2.5">
                  <p className="font-bold">{countFormatter.format(c.donorCount)}</p>
                  <p className="text-xs text-ink-faint">donasi</p>
                </div>
                <div className="rounded-xl bg-muted py-2.5">
                  <p className="font-bold">
                    <DaysLabel c={{ status: c.status === "completed" ? "completed" : "published", daysLeft: c.daysLeft }} />
                  </p>
                  <p className="text-xs text-ink-faint">tenggat</p>
                </div>
              </div>
              <div className="mt-5" data-testid="cta-desktop">
                <DonateButton slug={c.slug} status={c.status} />
              </div>
              <ShareButton title={c.title} className="mt-2 w-full" />
              <p className="mt-4 text-center text-xs text-ink-faint">
                Dikelola oleh Yayasan Tebar Kebaikan · Kuitansi otomatis
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-cta md:hidden"
        data-testid="cta-mobile"
      >
        <div className="mx-auto flex max-w-md gap-2">
          <ShareButton title={c.title} iconOnly className="px-4" />
          <DonateButton slug={c.slug} status={c.status} />
        </div>
      </div>
      <div className="h-20 md:hidden" />
    </>
  );
}
