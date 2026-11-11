import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

// P25: 404 global. Bagian dinamis (connection) membuat halaman ini dirender per permintaan
// sehingga script RSC-nya menerima nonce CSP — versi bawaan Next sepenuhnya statis dan
// script inline-nya diblokir CSP (security.md §5).
async function RequestBound() {
  await connection();
  return null;
}

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-semibold text-ink">Halaman tidak ditemukan</h1>
      <p className="text-sm text-ink-faint">Halaman yang kamu cari tidak ada atau sudah tidak tersedia.</p>
      <Link href="/" className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
        Kembali ke beranda
      </Link>
      <Suspense fallback={null}>
        <RequestBound />
      </Suspense>
    </main>
  );
}
