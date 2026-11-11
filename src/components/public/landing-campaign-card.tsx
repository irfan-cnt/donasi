import { Clock, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatRupiah, progressPercent } from "@/lib/money";
import type { CampaignCardData } from "@/server/queries/public-campaigns";
import { DaysLabel } from "./campaign-card";
import { lpButton } from "./landing-ui";

const countFormatter = new Intl.NumberFormat("id-ID");

/** Lencana "Mendesak": program berjalan dengan tenggat dua pekan atau kurang (desain beranda). */
const URGENT_DAYS = 14;

/**
 * Kartu program versi beranda (desain Nov 2026). Data sama dengan CampaignCard; tautan utama
 * tetap ke halaman program (/campaign/{slug}), tombol menuju formulir donasi yang sudah ada.
 */
export function LandingCampaignCard({ c, priority }: { c: CampaignCardData; priority?: boolean }) {
  const pct = c.targetAmount ? progressPercent(c.collectedAmount, c.targetAmount) : null;
  const urgent = c.status === "published" && c.daysLeft !== null && c.daysLeft <= URGENT_DAYS;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-white transition-[transform,box-shadow,border-color] duration-[250ms] hover:-translate-y-1 hover:border-[#D2E0D6] hover:shadow-[0_26px_48px_-30px_rgba(6,68,38,.5)] motion-reduce:transform-none">
      <Link
        href={`/campaign/${c.slug}`}
        className="flex flex-1 flex-col rounded-t-[20px] text-ink focus-visible:-outline-offset-[3px]"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-primary-soft">
          <Image
            src={c.imageUrl}
            alt={c.imageAlt}
            fill
            sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 90vw"
            priority={priority}
            // SVG lokal (placeholder seed) tidak dioptimasi oleh next/image.
            unoptimized={c.imageUrl.endsWith(".svg")}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
          />
          <span className="absolute top-3.5 left-3.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/95 px-[11px] py-[5px] text-xs leading-[1.3] font-bold text-primary-ink">
              {c.categoryName}
            </span>
            {urgent ? (
              <span className="rounded-full bg-danger px-[11px] py-[5px] text-xs leading-[1.3] font-bold text-white">
                Mendesak
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 px-5 pt-5">
          <h3 className="line-clamp-2 text-[17px] leading-[1.38] font-bold tracking-[-0.01em] transition-colors group-hover:text-primary">
            {c.title}
          </h3>
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="tabular text-lg font-extrabold tracking-[-0.01em] text-primary">
                {formatRupiah(c.collectedAmount)}
              </span>
              <span className="text-[13px] font-bold">
                {pct === null ? "Tanpa target" : `${pct}%`}
              </span>
            </div>
            {pct === null ? (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="lp-bar-open h-full w-full rounded-full" />
              </div>
            ) : (
              <div
                role="progressbar"
                aria-label="Progres penggalangan"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="text-[13px] text-ink-faint">
              {c.targetAmount
                ? `terkumpul dari ${formatRupiah(c.targetAmount)}`
                : "Donasi terbuka · tanpa target dana"}
            </p>
          </div>
          <div className="flex justify-between gap-3 border-t border-[#F0F2EE] pt-3 text-[13px] text-[#4F5750]">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {countFormatter.format(c.donorCount)} donasi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              <DaysLabel c={c} />
            </span>
          </div>
        </div>
      </Link>
      <div className="px-5 pt-3 pb-[22px]">
        <Link href={`/donasi/${c.slug}`} className={lpButton("green", "md", "w-full")}>
          Donasi Sekarang<span className="sr-only"> untuk {c.title}</span>
        </Link>
      </div>
    </article>
  );
}
