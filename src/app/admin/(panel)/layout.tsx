import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { logoutAdmin } from "@/server/actions/admin-auth-actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Layout sementara (shell lengkap = P20). Setiap halaman tetap memanggil requireAdmin sendiri.
async function AdminHeader() {
  const ctx = await requireAdmin();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-ink-soft sm:inline">
        {ctx.name} · {ctx.roles.join(", ")}
      </span>
      <form action={logoutAdmin}>
        <Button type="submit" variant="outline" size="sm">
          Keluar
        </Button>
      </form>
    </div>
  );
}

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <Link href="/admin" aria-label="Dashboard admin">
          <Logo />
        </Link>
        <Suspense fallback={null}>
          <AdminHeader />
        </Suspense>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
