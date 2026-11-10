"use client";

import { Home, LayoutGrid, ReceiptText, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Beranda", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/campaign",
    label: "Program",
    icon: LayoutGrid,
    match: (p: string) => p.startsWith("/campaign"),
  },
  // Riwayat donasi (/akun/transaksi) dibuat di P18; sementara diarahkan ke /akun.
  { href: "/akun", label: "Donasi Saya", icon: ReceiptText, match: () => false },
  { href: "/akun", label: "Akun", icon: UserRound, match: (p: string) => p.startsWith("/akun") },
] as const;

// Detail campaign punya sticky CTA sendiri (AC-02.3) → bottom nav disembunyikan di sana.
const HIDE_ON = /^\/campaign\/[^/]+(\/pratinjau)?\/?$/;

export function BottomNav() {
  const pathname = usePathname();
  if (HIDE_ON.test(pathname)) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Navigasi bawah"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-ink-faint",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
