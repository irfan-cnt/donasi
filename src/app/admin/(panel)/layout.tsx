import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { AdminMobileNav, AdminSideNav } from "@/components/admin/admin-nav";
import { AdminSearch } from "@/components/admin/admin-search";
import { Logo } from "@/components/shared/logo";
import { requireAdmin } from "@/lib/admin-auth";
import { navForPermissions } from "@/lib/admin-auth/admin-nav";
import { getEnv } from "@/lib/env";
import { logoutAdmin } from "@/server/actions/admin-auth-actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", finance: "Keuangan", editor: "Editor" };

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "A"
  );
}

// Shell admin (mockup AdminShell). Layout memanggil requireAdmin() untuk sesi; setiap halaman
// TETAP memanggil requireAdmin(permission) sendiri. Menu difilter permission (BR-40).
async function Shell({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const groups = navForPermissions(ctx.permissions);
  const production = getEnv().MIDTRANS_IS_PRODUCTION;
  const role = ctx.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ");

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-primary-ink px-3 py-5 lg:flex">
        <div className="px-3">
          <Logo light />
        </div>
        <span className="mx-3 mt-3 w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-gold-soft">
          Panel Admin
        </span>
        <div className="mt-6 flex-1 overflow-y-auto">
          <AdminSideNav groups={groups} />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
            {initials(ctx.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{ctx.name}</p>
            <p className="truncate text-xs text-white/60">{role}</p>
          </div>
          <form action={logoutAdmin}>
            <button type="submit" aria-label="Keluar" className="rounded p-1 text-white/70 hover:text-white">
              <LogOut className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-4 backdrop-blur sm:gap-3 lg:px-8">
          <AdminMobileNav groups={groups} />
          <AdminSearch />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span
              data-testid="env-badge"
              className={
                production
                  ? "inline-flex h-6 items-center rounded-full bg-danger-soft px-2 text-xs font-semibold text-danger"
                  : "inline-flex h-6 items-center rounded-full bg-warning-soft px-2 text-xs font-semibold text-warning"
              }
            >
              {production ? "Production" : "Sandbox"}
            </span>
            <form action={logoutAdmin} className="lg:hidden">
              <button type="submit" aria-label="Keluar" className="rounded-lg p-2 text-ink-soft hover:bg-muted">
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
