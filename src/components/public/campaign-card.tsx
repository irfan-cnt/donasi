import { Clock, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { CampaignCardData } from "@/server/queries/public-campaigns";
import { FundProgress } from "./fund-progress";

const countFormatter = new Intl.NumberFormat("id-ID");

export function DaysLabel({ c }: { c: Pick<CampaignCardData, "status" | "daysLeft"> }) {
  if (c.status === "completed") return <span className="text-ink-faint">Selesai</span>;
  if (c.daysLeft === null) return <span className="text-ink-faint">Berlangsung</span>;
  if (c.daysLeft === 0) return <span className="font-semibold text-danger">Hari terakhir</span>;
  return (
    <span className={cn(c.daysLeft <= 5 ? "font-semibold text-danger" : "text-ink-faint")}>
      {c.daysLeft} hari lagi
    </span>
  );
}

function CampaignImage({
  c,
  className,
  sizes,
  priority,
}: {
  c: CampaignCardData;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-primary-soft", className)}>
      <Image
        src={c.imageUrl}
        alt={c.imageAlt}
        fill
        sizes={sizes}
        priority={priority}
        // SVG lokal (placeholder seed) tidak dioptimasi oleh next/image.
        unoptimized={c.imageUrl.endsWith(".svg")}
        className="object-cover"
      />
    </div>
  );
}

export function CampaignCard({
  c,
  layout = "vertical",
  priority,
}: {
  c: CampaignCardData;
  layout?: "vertical" | "horizontal";
  priority?: boolean;
}) {
  const href = `/campaign/${c.slug}`;
  // Detail campaign (/campaign/[slug]) baru dibuat di P07; prefetch dimatikan sampai route
  // itu ada agar daftar panjang tidak memicu prefetch 404. Aktifkan kembali di P07.
  const prefetch = false;
  if (layout === "horizontal") {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className="flex w-full gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card transition hover:shadow-lift"
      >
        <CampaignImage
          c={c}
          sizes="144px"
          priority={priority}
          className="h-24 w-28 shrink-0 rounded-xl sm:h-28 sm:w-36"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-ink">{c.title}</h3>
          <p className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-faint">
            <span className="truncate">{c.categoryName}</span>
            <DaysLabel c={c} />
          </p>
          <div className="mt-auto pt-2">
            <FundProgress collected={c.collectedAmount} target={c.targetAmount} />
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative">
        <CampaignImage
          c={c}
          sizes="(min-width: 768px) 33vw, 288px"
          priority={priority}
          className="aspect-[16/10] w-full"
        />
        <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-ink">
          {c.categoryName}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 leading-snug font-semibold text-ink">{c.title}</h3>
        <div className="mt-auto pt-4">
          <FundProgress collected={c.collectedAmount} target={c.targetAmount} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="flex items-center gap-1 text-ink-faint">
            <Users className="size-3.5" aria-hidden />
            {countFormatter.format(c.donorCount)} donasi
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5 text-ink-faint" aria-hidden />
            <DaysLabel c={c} />
          </span>
        </div>
      </div>
    </Link>
  );
}
