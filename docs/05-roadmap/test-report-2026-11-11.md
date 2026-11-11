# Test Report P26 — QA Regresi Penuh (11 Nov 2026)

Basis: `main` @ `7f530d6` + perubahan P26 (belum di-commit). Lingkungan: build produksi lokal (`pnpm build` + `next start -p 3100`, `APP_URL=AUTH_URL=http://localhost:3100`, `NOTIFICATIONS_ENABLED=false WHATSAPP_ENABLED=false QSTASH_TOKEN="" BLOB_READ_WRITE_TOKEN=""`), Neon branch `dev`, Upstash nyata, Midtrans **sandbox**. Preview Vercel **tidak** dipakai (deployment preview sedang diblokir; lihat §7).

## 1. Ringkasan

| Item | Hasil |
|---|---|
| typecheck / lint | bersih / bersih (0 error, 0 warning) |
| Unit + integrasi (Vitest) | 5 run. Run akhir: **794 lulus, 2 gagal** (keduanya BUG-02, deterministik) dari 796 |
| E2E (Playwright, mobile Pixel 7 + desktop Chrome) | 4 run. Run akhir: **205 lulus, 18 gagal** (semuanya AC-32 = BUG-01), 3 skip (dedup viewport, sudah ada sebelumnya) |
| axe (WCAG 2.1 A/AA) | 18 halaman × 2 viewport = 36 audit, **0 pelanggaran** (semua impact) setelah perbaikan |
| AC | 99 AC: **83 lulus, 9 sebagian, 6 gagal, 1 tanpa test otomatis**; 96/99 punya test otomatis |
| Skenario testing-plan | 22: **18 lulus, 3 sebagian, 1 menunggu Preview** |
| Bug | 2 blocker, 1 high, 2 medium, 2 low (+5 aksesibilitas serious **sudah diperbaiki**) |
| Load test penuh (k6) | **Tidak dijalankan atas keputusan PM** (11 Nov 2026); hanya smoke lokal. Target beban NFR **belum terverifikasi** |
| @sandbox di Preview | **Tidak dijalankan** (Preview aktif lagi, tetapi spec memakai email donor `@example.test`, bukan alamat milik proyek; lihat §7) |
| Rekomendasi | **NO-GO** untuk Gate M8/P27 sampai syarat §9 terpenuhi |

## 2. Test yang ditambah/diubah

- `tests/e2e/helpers/fixtures.ts` (baru): fixture otomatis untuk **setiap** spec e2e. Test gagal bila ada `pageerror`, `console.error` (kecuali pesan "Failed to load resource … 4xx" pada test yang sengaja membuka 404/403), respons 5xx, atau request gagal ke origin aplikasi (`ERR_ABORTED` navigasi dikecualikan). Ke-15 spec kini mengimpor `test/expect` dari sini (hanya ganti import, logika test tidak diubah).
- `tests/e2e/p26-regression.spec.ts` (baru, 12 test × 2 viewport): AC-01.4, AC-02.3, AC-08.3, AC-32.1 (×4), AC-32.2 (×4 halaman), AC-32.3.
- `tests/e2e/a11y.spec.ts` (baru, 18 test × 2): axe di publik, checkout, instruksi/menunggu/berhasil, `/masuk`, `/admin/masuk`, 404, `/akun/**` dan admin (dashboard, transaksi, editor campaign). Gagal pada `serious`/`critical`; JSON per halaman di `test-results/axe/`.
- `tests/unit/admin-campaign.test.ts`: AC-33.2 (×5: 0, negatif, desimal, huruf, nominal valid).
- `tests/integration/admin-campaign.test.ts`: AC-33.5 (audit before/after tambah & hapus penyaluran).
- `tests/unit/donation-schema.test.ts`: AC-04.2 / skenario 3 (negatif & desimal ditolak server).
- `tests/e2e/checkout.spec.ts`: **perbaikan test** (bukan app). Nomor WA kini unik per run; lihat §6 F-2.
- k6: `tests/load/checkout.k6.js`, `tests/load/homepage.k6.js`, alat pembersih `scripts/load/cleanup-k6.ts` (§7).

## 3. Matriks AC → test → hasil

Legenda: ✅ lulus · 🟡 sebagian · ❌ gagal · ⚪ tanpa test otomatis. U = `tests/unit`, I = `tests/integration`, E = `tests/e2e`. Hasil = run akhir.

| AC | Test (file › judul) | Hasil |
|---|---|---|
| AC-01.1 | E home › "home merender hero… (AC-01.1)"; U seo › sitemap publik | ✅ |
| AC-01.2 | E home › "filter kategori memperbarui URL & daftar tanpa full reload" | ✅ |
| AC-01.3 | E home › "home merender hero…" (dialog = 0 setelah 1,5 s) | ✅ |
| AC-01.4 | E p26-regression › "AC-01.4: kartu campaign memuat judul, gambar ber-alt…" | ✅ |
| AC-01.5 | E home › "home merender hero, satu H1…", "metadata publik unik + canonical…" | ✅ |
| AC-02.1 | E campaign-detail › "draft & slug tak dikenal → 404" | ✅ |
| AC-02.2 | E campaign-detail › "{paused/completed}: CTA nonaktif dengan alasan" | ✅ |
| AC-02.3 | E p26-regression › "AC-02.3: di mobile CTA 'Donasi Sekarang' menempel…" | ✅ |
| AC-02.4 | E campaign-detail › "email/WA donatur tidak pernah ada di HTML (AC-02.4)"; U receipt-pdf › "'Hamba Allah' hanya bila…"; I create-donation | ✅ |
| AC-02.5 | U campaign-detail (waktu relatif, "dari sekarang"); E campaign-detail › "detail published…" | ✅ |
| AC-02.6 | E campaign-detail › "detail published: konten, CTA, JSON-LD, canonical, OG…" | ✅ |
| AC-03.1 | E campaign-detail › "berita draft / campaign salah / tak dikenal → 404" | ✅ |
| AC-03.2 | E campaign-detail › "detail berita: konten, kartu campaign + CTA, JSON-LD NewsArticle" | ✅ |
| AC-03.3 | E campaign-detail › "berita draft / campaign salah / tak dikenal → 404" | ✅ |
| AC-04.1 | E checkout › "Gate M3: 9999999999999999 tertahan 13 digit dan ditolak batas"; U donation-schema › "menolak < min dan > max" | ✅ |
| AC-04.2 | U donation-schema › "menolak nominal 13+ digit…", "menolak huruf", "AC-04.2 (skenario 3): nominal negatif / desimal…"; E checkout › "open: nominal + data…" (format 75.000) | ✅ |
| AC-04.3 | E checkout › "fixed: pilih paket → nominal dari DB…"; I admin-campaign › "paket nonaktif tidak muncul di checkout…" | ✅ |
| AC-04.4 | I create-donation › "menolak optionId paket milik campaign lain (AC-04.4 → 400)" | ✅ |
| AC-04.5 | I create-donation › "memakai nominal paket dari DB walau amount dimanipulasi (AC-04.5)" | ✅ |
| AC-04.6 | E checkout › "validasi inline: email & nama wajib" | ✅ |
| AC-04.7 | E checkout › "donatur login: prefill nama & email read-only" | ✅ |
| AC-04.8 | I rate-limits › "limit IP terlampaui → 429…", "P25 OD-31: limit per nomor WA…"; k6 smoke (10 lalu 429) | ✅ |
| AC-04.9 | E checkout › "open: nominal + data → halaman pembayaran"; k6 smoke lokal p95 448 ms / 335 ms | 🟡 p95 di beban penuh belum diukur (Preview) |
| AC-05.1 | E select-payment › "menampilkan metode aktif per grup…"; U payment-methods | ✅ |
| AC-05.2 | U payment-methods › "menyembunyikan metode yang tidak mendukung nominal & grup kosong" | ✅ |
| AC-05.3 | I create-payment › "klik ganda (paralel) → hanya satu payment aktif & satu charge" | ✅ |
| AC-05.4 | I create-payment › "membuat payment pending (id UUIDv7 = order_id) + instruksi…"; E select-payment › "pilih VA → payment sandbox dibuat → halaman instruksi" | ✅ |
| AC-05.5 | I create-payment › "error jaringan Midtrans tercatat di payment_events (create_error)…"; U midtrans › "error 400 → validation + create_error" | ✅ |
| AC-05.6 | U bundle-scan (4 test); `pnpm check:bundle-secrets` (P25) | ✅ |
| AC-06.1 | E transaction-pages › "instruksi VA (sandbox BNI): bank, nomor VA, salin, countdown…" | ✅ |
| AC-06.2 | U midtrans › "QRIS memakai qr_string…"; E payments.sandbox #1 | 🟡 UI QRIS e2e hanya di Preview |
| AC-06.3 | U midtrans › "GoPay → deeplink, tanpa URL QR"; E payments.sandbox #4 | 🟡 Preview |
| AC-06.4 | E transaction-pages › "polling berhenti → 'Cek status'; paid → berhasil" (paid disimulasikan); E payments.sandbox #1–3 | 🟡 ≤10 s setelah webhook nyata hanya di Preview |
| AC-06.5 | E transaction-pages › "payment kedaluwarsa → state expired + buat pembayaran baru" | ✅ |
| AC-06.6 | E select-payment › "token salah → 404…"; E transaction-pages › "endpoint status: token salah 404…" | ✅ |
| AC-07.1 | E transaction-pages › "instruksi VA… berhasil?status=paid → menunggu" | ✅ |
| AC-07.2 | E transaction-pages › "polling berhenti…" (unduh `kuitansi-KW-….pdf`); U receipt-pdf | ✅ |
| AC-07.3 | E transaction-pages › "polling berhenti…" ("Simpan riwayat donasimu") | ✅ |
| AC-07.4 | — (analytics belum ada di aplikasi, lihat BUG-04) | ❌ belum diimplementasi |
| AC-08.1 | U transaction-pages › "polling 5 s maks 10 menit (AC-08.1)" | ✅ |
| AC-08.2 | E transaction-pages › "polling berhenti → 'Cek status'; paid → berhasil" | ✅ |
| AC-08.3 | E p26-regression › "AC-08.3: halaman menunggu → tombol 'Lihat instruksi'…" | ✅ |
| AC-09.1 | I donor-dashboard (`ensureDonorAccount` membuat/menautkan donor) | 🟡 alur OAuth Google nyata = manual staging |
| AC-09.2 | — (callback `signIn` mengecek `email_verified === true`; inline di konfigurasi Auth.js, tidak dapat diuji tanpa refactor auth) | ⚪ review kode saja |
| AC-09.3 | E donor-auth › "callbackUrl eksternal diabaikan (AC-09.3)"; U callback-url | ✅ |
| AC-09.4 | Konfigurasi `useSecureCookies` (https) | 🟡 Secure hanya terverifikasi di https (Preview/manual) |
| AC-10.1 | E donor-auth › "akses /akun tanpa sesi → /masuk?callbackUrl=/akun (AC-10.1)" | ✅ |
| AC-10.2 | E donor-auth › "sesi valid membuka /akun, logout menghapus sesi DB (AC-10.2)" | ✅ |
| AC-10.3 | E admin-auth › "sesi donor tidak memberi akses /admin (AC-10.3)" | ✅ |
| AC-11.1 | I donor-dashboard › "klaim: email sama… (AC-11.1, AC-11.3)" | ✅ |
| AC-11.2 | I donor-dashboard › "klaim: email berbeda → tidak terklaim (AC-11.2)" | ✅ (OD-32 masih terbuka) |
| AC-11.3 | I donor-dashboard › "klaim: email sama… (AC-11.1, AC-11.3)" | ✅ |
| AC-12.1 | E donor-dashboard › "dashboard: ringkasan… (AC-12.1)" | ✅ |
| AC-13.1 | E donor-dashboard › "…kode milik donor lain → 404 (AC-13.1)"; I donor-dashboard › "IDOR…" | ✅ |
| AC-13.2 | I donor-dashboard › "riwayat: filter status & tahun + keyset 20 per halaman (AC-13.2)"; E › "riwayat: filter status & tahun" | ✅ |
| AC-14.1 | I receipt (AC-14.1); E donor-dashboard › "PDF: … expired → kuitansi nonaktif…" | ✅ |
| AC-14.2 | I receipt › "donor lain → 404…"; E donor-dashboard › "PDF … donor lain → 404" | ✅ |
| AC-14.3 | I receipt › "donor pemilik: kuitansi paid → PDF attachment, private no-store"; E transaction-pages | ✅ |
| AC-15.1 | U donor-dashboard › "menormalisasi WA ke +62", "menolak WA tidak valid…"; E › "profil: … WA (+62)…" | ✅ |
| AC-15.2 | I notify › "…WA opt-in → skipped"; I notify-whatsapp (consent per transaksi) | ✅ (diubah OD-19: consent per transaksi) |
| AC-16.1 | U payment-registry; arsitektur `PaymentProvider` | 🟡 hanya satu provider (OD-03), penggantian provider tidak dapat diuji |
| AC-17.1 | I midtrans-webhook › "signature salah → 401, event rejected, status tetap…"; U midtrans-webhook | ✅ |
| AC-17.2 | I midtrans-webhook › "payload sama 5× paralel → total +1, satu publish…"; I apply-verified-status › "5 panggilan paralel paid…" | ✅ (E sandbox #7 menunggu Preview) |
| AC-17.3 | I apply-verified-status › "expired setelah paid diabaikan (anomali tercatat, total tetap)" | ✅ |
| AC-17.4 | I apply-verified-status › "amount mismatch → tidak paid, alert…"; I midtrans-webhook › "nominal API ≠ payment → amount_mismatch" | ✅ |
| AC-18.1 | I jobs › "pending lewat expiry, provider masih pending → expirePayment lalu expired (AC-18.1)" | ✅ (flake 1/5, sebab lingkungan: F-1) |
| AC-18.2 | I jobs › "paid di provider, pending di DB → paid + issue…" | ✅ |
| AC-19.1 | I notify › "SMTP gagal → log failed + 500 (QStash retry), status pembayaran tidak berubah…" | ✅ |
| AC-19.2 | I notify › "…WA opt-in → skipped"; I notify-whatsapp | ✅ (OD-19/OD-31) |
| AC-20.1 | I admin-notifications › "AC-20.1: variabel ilegal ditolak saat simpan…"; E admin-notifications | ✅ |
| AC-20.2 | U admin-notifications › "pratinjau: nilai & teks di-escape…"; E › "pratinjau sandbox" | ✅ |
| AC-20.3 | I admin-notifications › "AC-20.3: kirim tes hanya ke email admin yang login…" | ✅ (diubah OD-23: tes WA ditolak) |
| AC-21.1 | U midtrans › "menghapus secret, menyamarkan PII…"; U admin-notifications › "penerima dimasking…" | ✅ |
| AC-22.1 | U admin-security › "lockout setelah 5 gagal, 15 menit (AC-22.1)"; I admin-auth-hardening; E admin-auth | ✅ |
| AC-22.2 | U admin-security (AC-22.2); E admin-auth › "role editor ditolak akses transaksi → 403 (AC-22.2)" | ✅ |
| AC-23.1 | I admin-dashboard › "KPI = nilai deterministik…" | ✅ |
| AC-24.1 | U admin-campaign (AC-24.1); I db-constraints › "menolak hapus campaign yang punya transaksi (AC-24.1)" | ✅ (OD-30) |
| AC-24.2 | I admin-campaign › "AC-24.2: open → fixed dengan transaksi pending memberi peringatan" | ✅ |
| AC-24.3 | U admin-campaign › "gambar tanpa alt tidak bisa disimpan (AC-24.3)" | ✅ |
| AC-25.1 | I admin-campaign › "berita: … publish mengisi published_at (AC-25.1)…" | ✅ |
| AC-26.1 | E admin-finance › "finance: … metode tanpa kredensial…"; I admin-finance (tes koneksi) | ✅ |
| AC-27.1 | U admin-finance › "tidak ada aksi/teks 'tandai lunas' / markPaid"; E admin-finance | ✅ |
| AC-27.2 | I admin-finance › "CSV mengikuti filter…", "startExport: … + audit…" | ✅ (masking OD-21) |
| AC-28.1 | U admin-export-routes › "403 editor … & admin tanpa donors.export untuk ekspor donatur" | ✅ |
| AC-30.1 | U admin-security › "audit diff"; I admin-campaign › "buat draft: … audit…" | ✅ |
| AC-31.1 | E home › "listing /campaign: H1, canonical, bagian selesai terpisah…"; U campaign-list | ✅ |
| AC-31.2 | E home › "filter kategori…", "slug kategori tidak valid diabaikan" | ✅ |
| AC-31.3 | E home › "listing /campaign … empty state", "empty state saat kategori tanpa campaign" | ✅ |
| AC-31.4 | E home › "listing /campaign: H1, canonical…" | ✅ |
| AC-32.1 | E p26-regression › "AC-32.1: {4 halaman} dapat diakses publik tanpa login (200)" | ❌ 404 (BUG-01) |
| AC-32.2 | E p26-regression › "AC-32.2: footer {/, /campaign, detail, /masuk} menautkan keempat halaman legal" | ❌ (BUG-01) |
| AC-32.3 | E p26-regression › "AC-32.3: teks persetujuan Checkout Form menautkan S&K dan Kebijakan Privasi" | ❌ teks tanpa tautan (BUG-01) |
| AC-32.4 | — (halaman `/kontak` tidak ada) | ❌ (BUG-01) |
| AC-33.1 | I admin-campaign › "penyaluran: hanya disbursements.write…"; U admin-campaign › "editor: … tidak bisa … penyaluran" | ✅ |
| AC-33.2 | I admin-campaign (melebihi terkumpul → ditolak); U admin-campaign › "AC-33.2: nominal …" (5 test) | ❌ "-1000" & "1500.5" diterima (BUG-02) |
| AC-33.3 | I admin-campaign › "M2: penyaluran ditolak untuk campaign draf dan bukti berita draf" | ✅ |
| AC-33.4 | E campaign-detail › "detail published…" (bagian "Rincian penggunaan dana") | 🟡 urutan & daftar entri tidak di-assert |
| AC-33.5 | I admin-campaign › "AC-33.5: tambah & hapus penyaluran tercatat di audit log dengan before/after" | 🟡 lulus; "ubah" tidak ada di aplikasi (BUG-06) |
| AC-33.6 | E campaign-detail › "detail published…" ("Belum ada penyaluran…") | ✅ |

Hitungan: ✅ 83 · 🟡 9 · ❌ 6 · ⚪ 1 = 99.

## 4. 22 skenario testing-plan

| # | Skenario | Bukti | Hasil |
|---|---|---|---|
| 1 | Open amount sampai instruksi | E checkout › "open…", E select-payment › "pilih VA… → instruksi" | ✅ |
| 2 | Fixed amount; manipulasi optionId/amount | E checkout › "fixed…"; I create-donation AC-04.4/04.5 | ✅ |
| 3 | Nominal ekstrem | U donation-schema (13+ digit, huruf, negatif, desimal, min/max); E "Gate M3" | ✅ |
| 4 | Pending → webhook paid → success | I midtrans-webhook/apply-verified-status; E transaction-pages (paid disimulasikan) | 🟡 simulator Midtrans hanya di Preview |
| 5 | Semua metode via simulator | I midtrans-sandbox (charge BCA VA nyata ✅); E select-payment/transaction-pages (BNI VA, Mandiri Bill nyata ✅) | ⏳ QRIS/GoPay/ShopeePay/simulator: Preview |
| 6 | Webhook 5× paralel → +1, notifikasi 1× | I midtrans-webhook › "payload sama 5× paralel…satu publish" | ✅ |
| 7 | Signature salah → 401 | I/U midtrans-webhook | ✅ |
| 8 | Nominal beda → amount_mismatch | I apply-verified-status, midtrans-webhook | ✅ |
| 9 | Expired via job | I jobs (AC-18.1) | ✅ (flake F-1) |
| 10 | Rekonsiliasi | I jobs (AC-18.2) | ✅ |
| 11 | `?status=paid` tidak mengubah status | E transaction-pages | ✅ |
| 12 | Login Google | E memakai sesi DB yang di-seed (tanpa mock OAuth); AC-09.2 tanpa test | 🟡 manual di staging |
| 13 | Klaim tamu | I donor-dashboard | ✅ |
| 14 | IDOR transaksi & PDF | E donor-dashboard; I receipt | ✅ |
| 15 | Editor → 403 | E admin-auth/admin-finance/admin-dashboard | ✅ |
| 16 | Lockout admin | I admin-auth-hardening; E admin-auth | ✅ |
| 17 | PDF isi & no-store | I receipt; E transaction-pages | ✅ |
| 18 | Email terkirim | I notify (transport palsu: sent/failed/retry) | 🟡 pengiriman Gmail nyata sengaja tidak dijalankan |
| 19 | WA tanpa opt-in tidak dikirim | I notify / notify-whatsapp | ✅ |
| 20 | Variabel template tak dikenal | I/E admin-notifications | ✅ |
| 21 | Responsif 360/768/1280 | E home, campaign-detail, checkout, select-payment, transaction-pages, donor-dashboard, admin-* | ✅ |
| 22 | Konsol tanpa error | Fixture `pageHealth` otomatis di semua 15 spec (+ cek 5xx & request gagal) | ✅ |

## 5. Daftar bug

| ID | Severity | Ringkasan | AC | Status |
|---|---|---|---|---|
| BUG-01 | **Blocker** | Halaman legal (T-49, OD-08) tidak ada: `/kebijakan-privasi`, `/syarat-ketentuan`, `/tentang`, `/kontak` → 404; footer & `/masuk` tanpa tautan; teks persetujuan checkout tanpa tautan | AC-32.1–32.4 | **Ditutup sebagian (P30/T-49, 11 Nov 2026):** 4 halaman draf + tautan footer/`/masuk`/checkout; e2e AC-32 hijau. Teks final legal masih dibutuhkan sebelum produksi (OD-34) |
| BUG-02 | **Blocker** (melanggar AC-33.2) | `moneySchema` admin (`src/lib/validation/admin-campaign.ts:52`) membuang semua non-digit: `"-1000"` → 1000, `"1500,5"`/`"1500.5"` → 15005 (10×). Dipakai untuk penyaluran **dan** target/min/maks/paket campaign | AC-33.2 | Terbuka, tidak diubah (logika nominal) |
| BUG-03 | **High** (lingkungan) | Ada deployment yang menulis ke Neon `dev` dengan notifikasi aktif + jadwal QStash + webhook Midtrans: email Gmail **nyata** terkirim (`admin.alert` berulang ke domain PM, `payment.expired` ke alamat fixture `example.test`), dan job global berpacu dengan test integrasi (F-1) | AC-18.1 (flake), isolasi uji | Terbuka, perlu PM |
| BUG-04 | Medium | Event analytics `donation_paid_view` belum ada (payment-architecture.md: "Belum ada analytics di aplikasi") | AC-07.4 | **Ditutup (P30):** `donation_paid_view` sekali per transaksi via Vercel Web Analytics (`TrackPaidView`); aktif hanya di Vercel dengan paket yang mendukung custom event |
| BUG-05 | Medium (observasi) | `pnpm build` ke-3 (Turbopack) menyajikan CSS basi: token `--tk-warning` lama tetap di chunk walau `globals.css` sudah berubah; build bersih (`rm -rf .next`) benar | — | Perlu investigasi, risiko cache build Vercel |
| BUG-06 | Low | Penyaluran hanya bisa tambah/hapus; "ubah" (F-33 alternatif) tidak ada | AC-33.5 | Terbuka |
| BUG-07 | Low | AC-09.2 tidak bisa diuji otomatis (callback `signIn` inline di `src/lib/auth/index.ts`) | AC-09.2 | Usulan: ekspor callback untuk unit test |
| A11Y-1..5 | Serious → **diperbaiki** | Lihat §8 | — | Ditutup |

**Reproduksi.**
- BUG-01: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/kebijakan-privasi` → `404`. Footer: `src/components/public/footer.tsx:5` ("ditambahkan di T-49"). Test: `tests/e2e/p26-regression.spec.ts`.
- BUG-02: `disbursementInputSchema.safeParse({…, amount: "-1000"})` → sukses dengan `1000n`. Test: `pnpm vitest run tests/unit/admin-campaign.test.ts -t "AC-33.2"` → 2 gagal. Saran perbaikan (tim finansial/owner): tolak string yang memuat `-`, koma, atau bagian desimal (mis. hanya `^(Rp\s?)?\d{1,3}(\.\d{3})*$|^\d+$`), lalu tambahkan test untuk input target/min/maks campaign.
- BUG-03: `select event, status, split_part(recipient,'@',2), created_at from notification_logs where created_at > now() - interval '6 hours'` di `dev` → puluhan `admin.alert` `sent` (respons "250 2.0.0 OK") dan 1 `payment.expired` `sent` ke `it+…@example.test` pada 05:30:07Z, padahal semua proses P26 berjalan dengan `NOTIFICATIONS_ENABLED=false` / `QSTASH_TOKEN=""`. Audit `payment.unknown_payment` `source: webhook` 05:30:36Z membuktikan deployment publik (yang dapat dijangkau Midtrans) memakai DB `dev`. Tindakan: periksa env Vercel (Preview/Development) `DATABASE_URL`/`NEON_BRANCH`, jadwal QStash, dan URL notifikasi Midtrans sandbox; pisahkan branch Neon untuk test integrasi.
- BUG-05: ubah token warna di `globals.css` → `pnpm build` (tanpa hapus `.next`) → `grep -o "tk-warning:[^;]*" -r .next/static` masih nilai lama. Mitigasi sementara: build CI/Vercel dari cache bersih bila CSS berubah; laporkan ke tim.

## 6. Analisis flake

| Suite | Run | Hasil |
|---|---|---|
| Vitest (unit+integrasi) | 1 | 789/789 |
| | 2 | 789/789 |
| | 3 | 788/789. `jobs.test.ts` AC-18.1 gagal + `afterAll` gagal FK `notification_logs` |
| | 4 | 789/789 |
| | 5 (dengan test baru) | 794/796. 2 gagal = BUG-02 (deterministik, bukan flake) |
| E2E | 1 (baseline, sebelum perubahan) | 163 lulus, 3 skip |
| | 2 (fixture & spec baru, sebelum perbaikan) | 167 lulus, 40 gagal (20 axe, 18 AC-32, 2 checkout) |
| | 3 | 205 lulus, 18 gagal (AC-32) |
| | 4 | 205 lulus, 18 gagal (AC-32), identik dengan run 3 |

- **F-1 (jobs AC-18.1, 1 dari 5 run).** Akar masalah: proses eksternal (BUG-03) menjalankan `expire-payments` **tanpa scope** ke DB `dev` tepat saat test. Payment uji (expired 10 menit lalu) di-expire duluan oleh proses itu, sehingga `runExpirePayments` milik test mendapat `changed=false` dan `r.expired = 0`. Proses yang sama mengirim email `payment.expired` (baris `notification_logs`), dan baris itu memblokir `afterAll` (FK). Bukan bug aplikasi; test tidak dilonggarkan. Fixture yang tertinggal (2 campaign `it-job-*`, 26 transaksi, `receipt_counters` −3) sudah dibersihkan manual. Perbaikan: isolasi DB (BUG-03).
- **F-2 (checkout e2e "open: nominal + data", run 2).** Akar masalah: test memakai nomor WA tetap `0812 3456 7890`, sedangkan P25 menambah limit `checkout-phone` 5/jam (sliding window, Upstash nyata dipakai bersama antar-run). Run ke-3 dalam satu jam tertahan 429 (terbukti dari kunci `tk:rl:checkout-phone:+62812****7890` bernilai 4 + 2). Perbaikan di test: nomor unik per run. Limiter tidak diubah.
- Tidak ada retry wrapper yang ditambahkan. `retries` Playwright tetap 0 lokal.

## 7. Load test (k6) & yang tidak dijalankan

**Skrip.** `tests/load/checkout.k6.js` (constant-arrival-rate `RATE`/menit, default 200, `DURATION` 5m) mengikuti alur donatur tanpa JS: GET form → POST multipart server action → 303 ke `/pembayaran`, **tanpa** memilih metode (tidak ada charge). Threshold: `checkout_create_ms p95<1000` (AC-04.9), sukses > 99 %, `http_req_failed < 1 %`, GET form p95 < 1,5 s. Penanda: email `k6+{RUN_ID}-{vu}-{iter}@example.test`, nama "K6 Load {RUN_ID}". `tests/load/homepage.k6.js`: 50 rps, p95 < 800 ms, p99 < 1,5 s, error < 1 %. Pembersih: `pnpm tsx scripts/load/cleanup-k6.ts --run-id <id> --branch <NEON_BRANCH> [--apply]`. Default dry-run. Wajib `--branch` = `NEON_BRANCH` env. Berhenti bila ada transaksi k6 yang memiliki payment.

**Smoke lokal (k6 v1.0.0 di scratchpad, ke `:3100`).**

| Uji | Hasil |
|---|---|
| homepage 5 rps × 15 s | 76 req, p95 30,4 ms, p99 35 ms, 0 error; semua threshold ✓ |
| checkout 12/menit × 20 s, `SPOOF_XFF=1` | 4 transaksi dibuat, p95 create 448 ms, sukses 100 % |
| checkout 45/menit × 20 s, satu IP, `EXPECT_RATE_LIMIT=1` | 10 dibuat lalu 5 terdeteksi `rate_limited` (tepat limit `checkout-ip` 10/jam) |
| cleanup | dry-run 4 + 10 → `--apply` hapus 14 transaksi + 14 donor tamu; guard branch salah menolak |

**Run penuh: tidak dijalankan atas keputusan PM (11 Nov 2026).** Konsekuensinya, target beban NFR (200 checkout/menit, homepage 50 rps, p95 AC-04.9 di bawah beban) **belum terverifikasi**. Ini bukan blocker go/no-go. Panduan berikut disimpan bila kelak diputuskan lain.

**Konfigurasi run penuh (bila kelak disetujui).** Limit checkout 10/jam per IP, 5/jam per email, dan 5/jam per WA. Di Vercel, IP diambil dari `x-vercel-forwarded-for` dan tidak bisa dipalsukan, sehingga satu mesin k6 ke Preview hanya mengukur limiter setelah 10 request. Opsi tanpa melemahkan limiter:
1. **Rekomendasi:** build produksi (`next start`) di VM satu region dengan Vercel, ke **branch Neon khusus** + database Upstash terpisah, dengan `SPOOF_XFF=1`. Ini mengukur aplikasi + DB + Redis, termasuk biaya limiter. `x-forwarded-for` hanya dipercaya di luar Vercel (security.md).
2. Ke Preview: `EXPECT_RATE_LIMIT=1` untuk mengukur jalur 429 dan homepage. Untuk 200/menit nyata butuh ≥100 IP egress (k6 terdistribusi).
3. Usulan (tidak dibangun): header token uji beban bertanda tangan yang hanya berlaku bila `APP_ENV=preview` dan `LOAD_TEST_SECRET` diisi, mengganti identifier `checkout-ip` per VU (limiter tetap berjalan). Perlu review keamanan sebelum dibangun.

Email unik per iterasi, nomor WA tidak diisi. 5 menit × 200 = ±1.000 transaksi `created` → bersihkan segera dengan `cleanup-k6.ts`.

**Suite @sandbox di Preview: tidak dijalankan.** Preview (`027cfa7`) aktif lagi, tetapi memakai Neon `dev` bersama dengan notifikasi nyata aktif. Syarat PM: email donor harus alamat milik proyek. `tests/e2e/helpers/sandbox-data.ts:32` membuat `e2e-sandbox+<uuid>@example.test` (bukan alamat proyek), dan pembersihan di baris 118/210 bergantung pada pola itu. Karena itu suite tidak dijalankan dan tidak ada transaksi yang dibuat di Preview. Agar dapat dijalankan: ubah helper agar memakai alamat penerima uji milik proyek (plus-addressing kotak pengirim proyek), sesuaikan pola cleanup, dan pastikan tidak ada centang WA atau nomor nyata (spec saat ini tidak mengisi WA).

**Perintah tepat (setelah syarat di atas dipenuhi):**
```bash
# 1. Suite @sandbox (7 skenario: QRIS/Permata, BCA VA, Mandiri Bill, GoPay, expire via QStash, ganti metode, notifikasi duplikat)
SANDBOX_BASE_URL=https://<url-preview> pnpm test:e2e          # project "sandbox"; bypass dari .env.local
# 2. k6 ke Preview: DIBATALKAN (keputusan PM), dicantumkan hanya sebagai referensi
k6 run -e BASE_URL=https://<url-preview> -e BYPASS_HEADER=$VERCEL_AUTOMATION_BYPASS_SECRET tests/load/homepage.k6.js
k6 run -e BASE_URL=https://<url-preview> -e BYPASS_HEADER=$VERCEL_AUTOMATION_BYPASS_SECRET -e EXPECT_RATE_LIMIT=1 -e RUN_ID=prev1 tests/load/checkout.k6.js
pnpm tsx scripts/load/cleanup-k6.ts --run-id prev1 --branch <branch-preview> --apply   # env DATABASE_URL/NEON_BRANCH branch preview
# 3. Manual di https: login Google nyata (AC-09.1, AC-09.2 dengan akun tak terverifikasi), cookie __Secure-authjs.session-token HttpOnly; Secure; SameSite=Lax (AC-09.4)
```
Menutup: AC-06.2/06.3/06.4, AC-17.2 (end-to-end), skenario 4 & 5, AC-04.9 (p95 beban).

Yang juga tidak dijalankan: pengiriman Gmail/Fonnte nyata (aturan sesi), Lighthouse (sudah di P24), uji manual browser sungguhan selain Playwright.

## 8. Aksesibilitas (axe 4.x, WCAG 2.1 A/AA)

Run pertama: 20 audit gagal. `color-contrast` serious (247 node, semua halaman), `definition-list` serious (detail campaign). Setelah audit admin/donor ditambah: label grup sidebar admin dan `scrollable-region-focusable` serious. Perbaikan (kecil, sesuai design-system):
1. `--tk-ink-faint` `#78827D` (3,97:1, padahal design-system menulis ≥4,5:1) → `#646E69` (5,28:1 di putih, ≥4,65:1 di bg/muted/primary-soft/gold-soft). `src/app/globals.css`, `docs/06-design/design-system.md`.
2. `--tk-warning` `#B46E0A` (3,69:1 di warning-soft) → `#965A00` (5,08:1). Mengenai banner countdown instruksi & badge "Menunggu".
3. `<p>` di dalam `<dl>` rincian dana → dipindah keluar `<dl>` (`src/components/public/campaign-detail-view.tsx`).
4. Label grup sidebar admin `text-white/50` (4,2:1) → `text-white/70` (6,7:1) (`src/components/admin/admin-nav.tsx`).
5. Wadah tabel transaksi terbaru dashboard admin: `tabIndex={0} role="region" aria-label` (`src/app/admin/(panel)/page.tsx`).

Run akhir: 36 audit, **0 pelanggaran** (critical/serious/moderate/minor).

## 9. Rekomendasi go/no-go

**NO-GO** untuk Gate M8 → P27/produksi. Syarat menjadi GO:
1. BUG-01 ditutup: empat halaman legal dengan teks final legal lembaga + tautan footer/`/masuk`/checkout; `p26-regression.spec.ts` AC-32 hijau.
2. BUG-02 diperbaiki (oleh pemilik logika nominal) + test AC-33.2 hijau + test serupa untuk input nominal campaign.
3. BUG-03: deployment yang memakai Neon `dev` diidentifikasi dan dipisahkan. Test integrasi memakai branch sendiri, dan email nyata dari data uji berhenti.
4. Helper `@sandbox` diubah ke email milik proyek, lalu suite `@sandbox` hijau 7/7 di Preview (kode transaksi dicatat di laporan).
5. (Bukan syarat) Load test penuh tidak dijalankan atas keputusan PM. Target beban NFR tetap **belum terverifikasi**; risiko diterima PM.
6. Keputusan PM untuk AC-07.4 (implementasi atau keluarkan dari MVP) dan BUG-05 (verifikasi build Vercel dari cache bersih).

Komponen lain (pembayaran, webhook, BR-18/BR-19, RBAC, IDOR, notifikasi, admin) lulus regresi penuh tanpa temuan baru.
