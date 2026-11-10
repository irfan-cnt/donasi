import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Transaksi — Admin Tebar Kebaikan" };

// Placeholder: daftar transaksi = P22. Sudah dijaga permission transactions.read (AC-22.2).
async function Transactions() {
  await requireAdmin("transactions.read");
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Transaksi</h1>
      <p className="mt-2 text-sm text-ink-soft">Daftar transaksi akan tersedia di P22.</p>
    </>
  );
}

export default function AdminTransactionsPage() {
  return (
    <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
      <Transactions />
    </Suspense>
  );
}
