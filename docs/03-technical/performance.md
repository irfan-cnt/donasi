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
