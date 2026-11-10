import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg px-4 text-center">
      <p className="text-sm font-semibold text-gold">403</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Akses ditolak</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">
        Peranmu tidak memiliki izin untuk membuka halaman ini.
      </p>
      <Link href="/admin" className="mt-6 text-sm font-semibold text-primary">
        ← Kembali ke dashboard
      </Link>
    </main>
  );
}
