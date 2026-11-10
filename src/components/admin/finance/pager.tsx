import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const num = new Intl.NumberFormat("id-ID");

/** Paginasi server (query string `hal`). `params` = filter aktif yang dipertahankan. */
export function Pager({ basePath, params, page, total, pageSize, noun }: { basePath: string; params: Record<string, string | undefined>; page: number; total: number; pageSize: number; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("hal", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-4 text-sm" aria-label="Paginasi">
      <span className="text-ink-faint">
        {num.format(total)} {noun} · halaman {num.format(Math.min(page, pages))} dari {num.format(pages)}
      </span>
      <div className="flex gap-2">
        <Link href={href(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}>
          Sebelumnya
        </Link>
        <Link href={href(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined} className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}>
          Berikutnya
        </Link>
      </div>
    </nav>
  );
}

/** Pill nada netral/sukses/bahaya untuk label teknis (verifikasi, hasil, kanal). */
export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "success" | "danger" | "warning" | "info"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-muted text-ink-soft",
    success: "bg-primary-soft text-primary-ink",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    info: "bg-gold-soft text-ink",
  } as const;
  return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold whitespace-nowrap", tones[tone])}>{children}</span>;
}
