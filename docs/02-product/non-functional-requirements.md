# Non-Functional Requirements

| ID | Kategori | Requirement | Ukuran |
|---|---|---|---|
| NFR-01 | Performa | LCP mobile (4G, Moto G Power) halaman publik | p75 ≤ 2,5 s |
| NFR-02 | Performa | INP | p75 ≤ 200 ms |
| NFR-03 | Performa | CLS | ≤ 0,1 |
| NFR-04 | Performa | JS first-load halaman publik | ≤ 150 KB gzip |
| NFR-05 | Performa | Server action `createDonation` | p95 ≤ 500 ms |
| NFR-06 | Performa | Pembuatan payment (termasuk API provider) | p95 ≤ 3 s |
| NFR-07 | Performa | Webhook diproses & dibalas | p95 ≤ 1 s |
| NFR-08 | Ketersediaan | Uptime halaman donasi & webhook | ≥ 99,5% / bulan |
| NFR-09 | Keandalan | Selisih rekonsiliasi tidak terselesaikan > 24 jam | 0 |
| NFR-10 | Keamanan | OWASP ASVS L2 untuk area auth, pembayaran, admin | lulus checklist security.md |
| NFR-11 | Keamanan | Rahasia hanya di env server; tidak ada `NEXT_PUBLIC_` untuk secret | review otomatis CI |
| NFR-12 | Keamanan | Header keamanan (CSP, HSTS, X-Frame-Options DENY, Referrer-Policy) | skor securityheaders.com A |
| NFR-13 | Privasi | Kepatuhan UU PDP No. 27/2022: consent, akses, koreksi, hapus akun | kebijakan tertulis |
| NFR-14 | Aksesibilitas | WCAG 2.2 AA untuk halaman publik & donor | axe 0 critical |
| NFR-15 | SEO | Metadata unik, canonical, JSON-LD, sitemap, robots | Lighthouse SEO ≥ 95 |
| NFR-16 | Responsif | Publik: 360–1440 px; Admin: optimal ≥ 768 px, tetap usable 360 px | Playwright viewport tests |
| NFR-17 | Kompatibilitas | Chrome/Edge/Firefox/Safari 2 versi terakhir; Android WebView (in-app Instagram/WA) | |
| NFR-18 | Skalabilitas | 200 donasi/menit puncak (Ramadhan), 50 req/s publik | load test k6 |
| NFR-19 | Observabilitas | Log terstruktur (JSON) dengan `requestId`; error tracking; alert webhook gagal | |
| NFR-20 | Auditabilitas | Semua perubahan finansial & admin tercatat, tidak bisa diubah via UI | |
| NFR-21 | Backup | Neon PITR ≥ 7 hari (production) | |
| NFR-22 | Maintainability | TypeScript strict, ESLint tanpa error, coverage service layer ≥ 80% | CI |
| NFR-23 | Lokalisasi | Format `id-ID` (Rp 1.250.000), zona `Asia/Jakarta` | |
