"use client";

import {
  CreditCard,
  FileClock,
  LayoutDashboard,
  Mail,
  Megaphone,
  Menu,
  Newspaper,
  ReceiptText,
  ScrollText,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AdminNavGroup, AdminNavIcon } from "@/lib/admin-auth/admin-nav";
import { cn } from "@/lib/utils";

const ICONS: Record<AdminNavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  campaign: Megaphone,
  news: Newspaper,
  transactions: ReceiptText,
  donors: Users,
  "payment-methods": CreditCard,
  "payment-logs": Webhook,
  templates: Mail,
  "notification-logs": FileClock,
  audit: ScrollText,
};

const isActive = (href: string, pathname: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

export function AdminSideNav({ groups, onNavigate }: { groups: AdminNavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5" aria-label="Menu admin">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-[11px] font-semibold tracking-wider text-white/70 uppercase">{g.title}</p>
          <ul className="mt-1.5 space-y-0.5">
            {g.items.map(({ href, label, icon }) => {
              const Icon = ICONS[icon];
              const active = isActive(href, pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Drawer menu untuk layar < lg. */
export function AdminMobileNav({ groups }: { groups: AdminNavGroup[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="rounded-lg p-2 text-ink hover:bg-muted lg:hidden"
        aria-label="Buka menu"
        data-testid="admin-menu-button"
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 overflow-y-auto border-0 bg-primary-ink px-3 py-5 text-white"
        data-testid="admin-drawer"
      >
        <SheetTitle className="px-3">
          <Logo onDark size="sm" />
          <span className="sr-only">Menu admin</span>
        </SheetTitle>
        <div className="mt-2">
          <AdminSideNav groups={groups} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
