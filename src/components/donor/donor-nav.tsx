"use client";

import { LayoutDashboard, ReceiptText, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/akun", label: "Ringkasan", icon: LayoutDashboard, match: (p: string) => p === "/akun" },
  { href: "/akun/donasi", label: "Riwayat Donasi", icon: ReceiptText, match: (p: string) => p.startsWith("/akun/donasi") },
  { href: "/akun/profil", label: "Profil", icon: UserRound, match: (p: string) => p.startsWith("/akun/profil") },
] as const;

export function DonorNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu akun" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap",
                  active ? "bg-primary-soft text-primary-ink" : "text-ink-soft hover:bg-muted",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
