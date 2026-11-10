import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Dashboard — Admin Tebar Kebaikan" };

async function Dashboard() {
  const ctx = await requireAdmin();
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Assalamu&apos;alaikum, {ctx.name}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Dashboard admin sedang disiapkan (P20). Peran: {ctx.roles.join(", ")}.
      </p>
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
      <Dashboard />
    </Suspense>
  );
}
