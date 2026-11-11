# Performance

## Budget

| Metrik | Target |
|---|---|
| LCP p75 mobile | ≤ 2,5 s |
| INP p75 | ≤ 200 ms |
| CLS | ≤ 0,1 |
| JS first load (publik) | ≤ 150 KB gzip |
| Gambar hero | ≤ 120 KB (AVIF/WebP), `priority` |
| TTFB halaman ISR | ≤ 200 ms (edge cache) |

## Strategi
1. **RSC by default**; client component hanya untuk interaksi (chip nominal, countdown, polling, salin).
2. **ISR + tag revalidation** untuk Home/Campaign/News; `revalidateTag('campaign:{slug}')` saat paid/publish (di-throttle 1×/10 s per campaign via Redis agar tidak badai revalidasi saat ramai).
3. **Cache Redis** untuk: daftar kategori (1 jam), kartu campaign pilihan (60 s), statistik platform (5 menit), daftar metode bayar aktif (5 menit, invalidasi saat admin ubah).
4. **next/image** dengan ukuran eksplisit; placeholder blur; lazy-load galeri.
5. **Font**: `next/font` self-host, 2 keluarga maksimal, `display: swap`.
6. **Database**: indeks sesuai ../04-database/indexes.md; query daftar memakai keyset pagination; agregat dashboard admin dari tabel ringkasan harian (`daily_donation_stats` materialized view yang direfresh job tiap 15 menit) bila data > 100 ribu transaksi. P20 (11 Nov 2026): agregat langsung ke `transactions` (`src/server/repositories/admin-dashboard-repository.ts`), EXPLAIN ANALYZE di Neon `dev` (~320 transaksi, rentang 90 hari) 0,05–0,42 ms per query → materialized view belum dibuat (ambang 300 ms). Bila volume naik, kandidat pertama indeks `(status, paid_at)` sebelum matview.
7. **Driver Neon HTTP** untuk query tunggal (latensi rendah di serverless), Pool/WebSocket untuk transaksi multi-statement (webhook).
8. **Region co-location**: Vercel `sin1`, Neon & Upstash `ap-southeast-1`.
9. Tanpa pop-up, tanpa library carousel berat (CSS scroll-snap).

## Pengukuran
Vercel Speed Insights (RUM), Lighthouse CI di PR (assert budget), k6 load test sebelum Ramadhan/kampanye besar (200 checkout/menit).

## Implementasi P24 (11 Nov 2026)
- **Cache Redis** (`src/lib/redis/cache.ts`, prefix `tk:cache:`): kategori `categories:v1` 1 jam, kartu pilihan `featured:v1` 60 s (baru, P24), statistik `platform-stats:v1` 5 menit, metode bayar aktif 5 menit (invalidasi saat admin ubah). Kunci selalu konstanta — tidak ada bagian kunci dari query string; filter `?kategori=` di-whitelist terhadap slug kategori DB sebelum menjadi argumen `"use cache"`. Hanya data publik agregat; tidak ada data donor/sesi/admin di kunci bersama. Redis error → fail-open ke DB (log warn).
- **Invalidasi**: perubahan admin → `revalidateTag(..., { expire: 0 })` + hapus `featured:v1`. Pembayaran `paid` (webhook/rekonsiliasi) → `revalidateTag('campaign:{slug}')` & `campaigns` **di-throttle 1×/10 s per tag** via `SET NX EX 10` (`tk:throttle:revalidate:{tag}`), saat tag `campaigns` lolos throttle `featured:v1` dihapus lebih dulu. Batas basi total campaign di halaman publik ≈ jendela throttle 10 s + render ulang (stale-while-revalidate), kartu pilihan ≤ 60 s, statistik ≤ 5 menit. Status transaksi untuk donatur (`/transaksi/*`, `/api/transactions/[code]/status`) tidak di-cache.
- **Shell statis**: `(public)/loading.tsx` dihapus — sebelumnya seluruh konten Home/Detail berada di balik boundary Suspense dan baru tampil lewat skrip reveal; kini hero/H1 ada langsung di HTML prerender (bersama pengurangan JS: LCP lokal Home 3,64→3,07 s, Detail 3,49→3,13 s).
- **Cache Components & App Shell (perbaikan 11 Nov 2026, galat dev "Blocking Route")**: dengan `partialPrefetching: true`, konten `"use cache"` hanya masuk App Shell bila `cacheLife.stale` ≥ 300 s (`node_modules/next/dist/docs/.../cacheLife.md` §Prerendering behavior; glossary "App Shell"). Profil lama `stale: 60` membuat hero/statistik/"butuh segera" & detail campaign dianggap data tak ter-cache di shell, sehingga validasi `instant` (default `validationLevel: 'warning'`, hanya dev) melaporkan *uncached data* / *URL data* di `/` dan `/campaign/[slug]`; `pnpm build` tidak terpengaruh. Perbaikan: semua query publik (`public-campaigns.ts`, `public-campaign-detail.ts`, `public-organization.ts`) memakai `stale: 300`. `stale` hanya umur cache router klien (server tetap `revalidate` 60/300 s + tag, `revalidateTag` dari server action mengosongkan cache klien), jadi batas basi di atas tidak berubah untuk muat halaman penuh; navigasi klien bisa memakai salinan ≤ 5 menit. Detail campaign & berita membaca `params` di level atas agar slug tak dikenal tetap **404 sungguhan** → `export const instant = false` (rute blocking; konten slug `generateStaticParams` tetap diprerender penuh). Rute alur memakai `await connection()` sebelum akses DB/waktu (`/donasi/[slug]`, `/transaksi/[code]/*`), `/akun/**` mendapat `loading.tsx` (area privat; shell publik tidak berubah), `/akses-ditolak` (selalu 403) `instant = false`.
- **Bundle publik**: Zod keluar dari bundle checkout (`src/lib/validation/donation-input.ts` tanpa Zod, −34 KB gzip); `sonner`/Toaster keluar dari root layout (hanya `/transaksi/*`), tombol Bagikan memakai umpan balik inline (−9 KB gzip di semua halaman publik).
- **Hasil lokal** (Lighthouse 12.8.2 mobile, median 3 run, `next start`): lihat laporan P24. JS first-load ≈ 164–171 KB gzip → **budget 150 KB belum tercapai**: lantai framework (React DOM ≈ 70 KB + router Next 16 ≈ 60 KB) sudah ≈ 135 KB; sisa terbesar milik aplikasi: `cn` (tailwind-merge) ≈ 10 KB, `@base-ui` Button, `next/image` klien, lucide. LCP simulasi ≈ 3,1 s (Home/Detail) → **belum ≤ 2,5 s**; elemen LCP berupa teks yang render-delay-nya didominasi unduh+eksekusi JS pada simulasi slow-4G.
- **Speed Insights**: `@vercel/speed-insights` hanya di layout publik & `/donasi/*`, hanya bila build di Vercel (`VERCEL=1`); query string & hash dibuang (`beforeSend`) agar token `?t=`/`?trx=` tidak terkirim. Tidak dipasang di `/admin`, `/akun`, `/transaksi`.
- **Lighthouse CI**: `.github/workflows/lighthouse.yml` + `lighthouserc.cjs` (lihat deployment.md).
