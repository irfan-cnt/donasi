import Link from "next/link";
import { cn } from "@/lib/utils";
import type { PublicCategory } from "@/server/queries/public-campaigns";
import { CategoryIcon } from "./category-icon";

/** Filter kategori via `?kategori=` (navigasi klien, tanpa full reload — AC-01.2). */
export function CategoryChips({
  categories,
  active,
  basePath,
}: {
  categories: PublicCategory[];
  active: string | undefined;
  basePath: "/" | "/campaign";
}) {
  const items = [{ slug: undefined, name: "Semua", icon: null }, ...categories];
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
