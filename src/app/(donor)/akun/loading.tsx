// Batas Suspense per halaman /akun/**: data sesi donatur selalu dinamis (requireDonor →
// connection()), jadi navigasi antar-halaman akun menampilkan kerangka ini lebih dulu.
// Area privat (noindex) — tidak memengaruhi shell publik/LCP (performance.md).
export default function DonorAccountLoading() {
  return <div className="h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />;
}
