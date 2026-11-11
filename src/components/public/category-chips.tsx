import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PublicCategory } from "@/server/queries/public-campaigns";
import { CategoryIcon } from "./category-icon";

/** Filter kategori via `?kategori=` (navigasi klien, tanpa full reload — AC-01.2). */
export function CategoryChips({
  categories,
  active,
  basePath,
  variant = "default",
}: {
  categories: PublicCategory[];
  active: string | undefined;
  basePath: "/" | "/campaign";
  /** "landing" = chip desain beranda (tinggi 44 px, ikon di semua chip). */
  variant?: "default" | "landing";
}) {
  const items = [{ slug: undefined, name: "Semua", icon: null }, ...categories];
  if (variant === "landing") {
    return (
      <nav aria-label="Filter kategori">
        <ul className="-mx-4 flex snap-x gap-1.5 overflow-x-auto overscroll-x-contain px-4 pt-1 pb-2.5 [scrollbar-color:#C4D9CB_transparent] [scrollbar-width:thin] sm:mx-0 sm:px-[3px]">
          {items.map((c) => {
            const selected = active === c.slug;
            return (
              <li key={c.slug ?? "semua"} className="shrink-0 snap-start">
                <Link
                  href={c.slug ? `${basePath}?kategori=${c.slug}` : basePath}
                  scroll={false}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-[13px] text-[13.5px] font-semibold whitespace-nowrap transition-colors",
                    selected
                      ? "border-primary bg-primary text-white"
                      : "border-[#D5DED7] bg-white text-ink-soft hover:border-primary hover:text-primary",
                  )}
                >
                  {c.slug ? (
                    <CategoryIcon name={c.icon} className="size-4" />
                  ) : (
                    <LayoutGrid className="size-4" aria-hidden />
                  )}
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label="Filter kategori">
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {items.map((c) => {
          const selected = active === c.slug;
          const href = c.slug ? `${basePath}?kategori=${c.slug}` : basePath;
          return (
            <li key={c.slug ?? "semua"} className="shrink-0">
              <Link
                href={href}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition",
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-ink-soft hover:border-primary/40",
                )}
              >
                {c.slug ? <CategoryIcon name={c.icon} className="size-4" /> : null}
                {c.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
