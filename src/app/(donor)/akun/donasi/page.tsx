import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TrxList } from "@/components/donor/trx-list";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireDonor } from "@/lib/auth";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { decodeDonorCursor, donorListQuery, encodeDonorCursor, type DonorTrxCursor } from "@/lib/validation/donor";
import { getDonorTransactionList } from "@/server/services/donor-account-service";

export const metadata: Metadata = { title: `Riwayat Donasi — ${SITE_NAME}` };

const STATUS_OPTIONS = [
  ["", "Semua status"],
  ["paid", "Berhasil"],
  ["pending", "Menunggu"],
  ["expired", "Kedaluwarsa"],
  ["failed", "Gagal"],
  ["cancelled", "Dibatalkan"],
  ["refunded", "Dikembalikan"],
] as const;

const selectClass =
  "h-9 rounded-lg border border-input bg-surface px-3 text-sm text-ink focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

// Riwayat donasi (F-13, AC-13.2): filter status & tahun (GET), keyset 20 per halaman.
export default async function DonorTransactionsPage({ searchParams }: PageProps<"/akun/donasi">) {
  const donor = await requireDonor("/akun/donasi");
  const q = donorListQuery.parse(await searchParams);
  const after = decodeDonorCursor(q.setelah);
  const before = after ? null : decodeDonorCursor(q.sebelum);
  const { items, next, prev, years } = await getDonorTransactionList({
    donorId: donor.donorId,
    status: q.status,
    year: q.tahun,
    after,
    before,
  });
  const filtered = !!q.status || !!q.tahun;

  const href = (cursor: { setelah?: DonorTrxCursor; sebelum?: DonorTrxCursor }) => {
    const p = new URLSearchParams();
    if (q.status) p.set("status", q.status);
    if (q.tahun) p.set("tahun", String(q.tahun));
    if (cursor.setelah) p.set("setelah", encodeDonorCursor(cursor.setelah));
    if (cursor.sebelum) p.set("sebelum", encodeDonorCursor(cursor.sebelum));
    const s = p.toString();
    return s ? `/akun/donasi?${s}` : "/akun/donasi";
  };

  return (
    <>
      <h1 className="text-xl font-bold text-ink md:text-2xl">Riwayat Donasi</h1>
      <form method="get" className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filter riwayat">
        <select name="status" defaultValue={q.status ?? ""} aria-label="Filter status" className={selectClass}>
          {STATUS_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="tahun" defaultValue={q.tahun ? String(q.tahun) : ""} aria-label="Filter tahun" className={selectClass}>
          <option value="">Semua tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary">
          Terapkan
        </Button>
        {filtered && (
          <Link href="/akun/donasi" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Reset
          </Link>
        )}
      </form>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-2 sm:p-3">
        {items.length ? (
          <TrxList items={items} />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Tidak ada transaksi"
            description={filtered ? "Tidak ada transaksi dengan filter ini." : "Donasi yang kamu lakukan akan muncul di sini."}
          />
        )}
      </div>

      {(prev || next) && (
        <nav className="mt-4 flex items-center justify-end gap-2" aria-label="Paginasi">
          <Link
            href={prev ? href({ sebelum: prev }) : "#"}
            aria-disabled={!prev}
            tabIndex={prev ? undefined : -1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), !prev && "pointer-events-none opacity-50")}
          >
            Sebelumnya
          </Link>
          <Link
            href={next ? href({ setelah: next }) : "#"}
            aria-disabled={!next}
            tabIndex={next ? undefined : -1}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), !next && "pointer-events-none opacity-50")}
          >
            Berikutnya
          </Link>
        </nav>
      )}
    </>
  );
}
