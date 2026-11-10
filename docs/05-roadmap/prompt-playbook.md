# Prompt Playbook — Tebar Kebaikan (Midtrans)

Rangkaian prompt siap-salin untuk membangun Tebar Kebaikan dari repo kosong sampai go-live dan materi peluncuran. Pembayaran **hanya Midtrans Core API** (keputusan OD-03, 10 Nov 2026).

## Cara pakai

1. Jalankan prompt **berurutan**, satu prompt per sesi Claude Code di root repo. Jangan menggabungkan dua prompt.
2. Setiap prompt diakhiri **Laporan milestone** (format di `CLAUDE.md`). Baca laporannya, jalankan **Cek PM** di bawah prompt, baru lanjut.
3. Bila sesi terputus atau konteks penuh, pakai prompt **R1 – Lanjutkan pekerjaan** (bagian akhir).
4. Jangan pernah menempel secret (server key, password, token) di chat. Isi di `.env.local` dan Vercel Environment Variables sendiri.
5. Kolom **Gate** berarti kamu (PM) harus menyetujui sebelum lanjut.

## Persiapan PM (sebelum P01)

| # | Siapkan | Dipakai di | Catatan |
|---|---|---|---|
| 1 | Repo GitHub kosong `tebar-kebaikan` (private) | P01 | Aktifkan branch protection `main` setelah P01 |
| 2 | Akun Vercel (team), terhubung ke GitHub | P01 | Region fungsi `sin1` |
| 3 | Project Neon (region Singapura) + branch `dev` | P01–P02 | Aktifkan integrasi Neon ↔ Vercel |
| 4 | Upstash: 1 database Redis dev, 1 prod; QStash | P01, P14 | |
| 5 | Google Cloud: OAuth client (Web) + consent screen | P04 | Redirect URI: `http://localhost:3000/api/auth/callback/google` dan domain preview/prod |
| 6 | **Akun Midtrans Sandbox** → Server Key & Client Key | P10 | Dashboard Sandbox → Settings → Access Keys |
| 7 | **Pengajuan akun Midtrans Production** (legalitas yayasan, rekening, NPWP) | P27 | Mulai sekarang — jalur kritis 1–3 minggu |
| 8 | Gmail/Workspace khusus notifikasi + App Password | P16 | Wajib 2FA aktif di akun Google tersebut |
| 9 | Fonnte: nomor khusus + token device | P17 | |
| 10 | Domain + DNS | P27 | |
| 11 | Keputusan OD-01, 02, 04–10 di `docs/open-decisions.md` | P00 | |

## Peta prompt

| Prompt | Isi | Milestone | Tugas | Est. | Gate PM |
|---|---|---|---|---|---|
| P00 | Persetujuan Phase 1 & penyelarasan keputusan | — | — | 0,5 h | ✅ |
| P01 | Setup repo, tooling, infrastruktur | M1 | T-01–03, T-07, T-08 | 1 h | |
| P02 | Skema database & migrasi | M1 | T-04, T-05 | 1,5 h | |
| P03 | Seed data & skrip admin | M1 | T-06 | 0,5 h | ✅ |
| P04 | Login donatur Google | M2 | T-09, T-10 | 1 h | |
| P05 | Auth admin, RBAC, audit log | M2 | T-11–T-13 | 1,5 h | ✅ |
| P06 | Layout publik & Home | M3 | T-14, T-15 (+T-16) | 1,5 h | |
| P07 | Campaign Detail & News Detail | M3 | T-17, T-18 | 1,5 h | |
| P08 | Checkout Form & `createDonation` | M3 | T-19 | 1,5 h | ✅ |
| P09 | Inti pembayaran: interface & state machine | M4 | T-22 | 1,5 h | |
| P10 | Adapter Midtrans Core API | M4 | T-23 | 2 h | |
| P11 | Select Payment & `createPayment` | M4 | T-20, T-25 | 1 h | |
| P12 | Instruction, Success, Pending + status | M4 | T-21 | 1,5 h | |
| P13 | Webhook Midtrans | M4 | T-24 | 1,5 h | |
| P14 | Job expiry, cancel, rekonsiliasi, scheduler | M4/M8 | T-44 | 1,5 h | |
| P15 | Uji E2E sandbox Midtrans | M4 | T-27 | 1 h | ✅ |
| P16 | Notifikasi inti + email Gmail | M5 | T-28, T-29, T-31 | 1,5 h | |
| P17 | WhatsApp Fonnte | M5 | T-30 | 0,5 h | ✅ |
| P18 | Donor dashboard & klaim transaksi tamu | M6 | T-32, T-33, T-35 | 2 h | |
| P19 | PDF transaksi & kuitansi | M6 | T-34 | 1,5 h | ✅ |
| P20 | Layout admin & dashboard | M7 | T-36 | 1,5 h | |
| P21 | Admin campaign & berita | M7 | T-37, T-38 | 3 h | |
| P22 | Admin keuangan: metode, transaksi, donatur, log, audit | M7 | T-39–T-41, T-43 | 3 h | |
| P23 | Admin template & log notifikasi | M7 | T-42 | 1,5 h | ✅ |
| P24 | Performa, SEO, cache | M8 | T-46 | 1 h | |
| P25 | Hardening & review keamanan | M8 | T-45, T-48 | 2 h | |
| P26 | QA regresi penuh | M8 | T-47 | 2 h | ✅ |
| P27 | Persiapan produksi Midtrans | Rilis | — | 1 h | ✅ |
| P28 | Go-live & laporan penyelesaian | Rilis | — | 1 h | ✅ |
| P29 | Landing page brief | Phase 3 | — | 0,5 h | ✅ |
| P30 | Implementasi landing page | Phase 3 | — | 1,5 h | |
| P31 | Paket Instagram: profil, feed, carousel | Phase 3 | — | 1,5 h | |
| P32 | Reels, voiceover, kalender konten | Phase 3 | — | 1 h | ✅ |

Est. = perkiraan waktu kerja agent per prompt (jam), di luar waktu review PM.

---

## P00 — Persetujuan Phase 1 & penyelarasan keputusan

**Prasyarat:** kamu sudah mereview dokumen & mockup, dan mengisi keputusan di `docs/open-decisions.md`.

```text
Phase 1 DISETUJUI. Kita masuk Phase 2 — Development.

Keputusan PM:
- OD-03: pembayaran hanya Midtrans Core API (sudah tercatat).
- OD-01 nama brand: <isi atau "tetap Tebar Kebaikan">
- OD-04 biaya gateway ditanggung: <lembaga/donatur>
- OD-06 rincian penyaluran dana masuk MVP: <ya/tidak>
- OD-07 halaman listing /campaign: <ya/tidak>
- OD-08 halaman legal (privasi, S&K, tentang, kontak): <ya/tidak>
- OD-10 notifikasi donation.created: <aktif/nonaktif>
- OD-12 penyimpanan gambar: <Vercel Blob/R2>
- OD-13 error tracking: <Sentry/tidak>

Tugas:
1. Baca CLAUDE.md, AGENTS.md, docs/open-decisions.md, docs/02-product/scope.md.
2. Catat semua keputusan di atas di docs/open-decisions.md (tandai ✅ + tanggal). Untuk setiap "ya" yang menambah scope, tulis usulan singkat di docs/02-product/proposals/ lalu tambahkan ke scope.md, functional-requirements.md, acceptance-criteria.md, schema.md, dan implementation-order.md.
3. Selaraskan mockup dengan Midtrans-only: di design-mockups/src/data/sample.ts semua provider = Midtrans; metode = QRIS, GoPay, ShopeePay, BCA/BNI/BRI/Permata/CIMB VA, Mandiri Bill; hapus kartu provider Xendit di halaman admin Payment Methods. Jalankan npm run typecheck && npm run build di design-mockups.
4. Ubah status fase di CLAUDE.md menjadi "Phase 2 — Development (disetujui <tanggal>)" dan izinkan perubahan src/.
5. Jangan menulis kode aplikasi di prompt ini.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM:** `open-decisions.md` sudah terisi; mockup tidak lagi menyebut Xendit.

---

## P01 — Setup repo, tooling, infrastruktur

**Prasyarat:** Persiapan PM #1–4 selesai. `.env.local` berisi `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `UPSTASH_*`, `QSTASH_*`, `AUTH_SECRET`.

```text
Kerjakan Development Step 1 (T-01, T-02, T-03, T-07, T-08) sesuai docs/05-roadmap/implementation-order.md dan README.md#struktur-proyek.

1. Inisialisasi Next.js (App Router, TypeScript strict, src/, pnpm) DI ROOT repo ini tanpa menimpa docs/, design-mockups/, CLAUDE.md, AGENTS.md, .claude/, .env.example, README.md.
2. Pasang Tailwind + shadcn/ui (Button, Card, Badge, Input, Textarea, Select, Switch, Checkbox, Dialog, Sheet, Tabs, Table, Skeleton, Alert, Sonner) dan Lucide. Pindahkan token desain dari design-mockups/src/styles/globals.css & tailwind.config.js ke tema aplikasi (light theme). Font Plus Jakarta Sans + Fraunces via next/font.
3. ESLint + Prettier (+ plugin tailwind), aturan: larang `NEXT_PUBLIC_` berisi SECRET/KEY/TOKEN/PASSWORD, larang `sql.raw`.
4. Struktur folder: src/app/{(public),(auth),(donor),admin,api}, src/components/{ui,shared,public,donor,admin}, src/features/*, src/lib/{auth,db,redis,qstash,payments,email,whatsapp,pdf,validation,security}, src/server/{actions,services,repositories}, src/types, drizzle/, scripts/, tests/{unit,integration,e2e}.
5. Konfigurasi Drizzle + driver @neondatabase/serverless (HTTP untuk query, Pool untuk transaksi) di src/lib/db; koneksi uji `select 1`.
6. Upstash: src/lib/redis (client + util rate limit @upstash/ratelimit), src/lib/qstash (publish + verifikasi signature Receiver).
7. Util inti T-08: money (bigint) + formatRupiah, kode transaksi TK-YYMMDD-XXXXXX (base32 Crockford), UUIDv7, logger JSON dengan requestId, env loader tervalidasi Zod (src/lib/env.ts, server-only) yang gagal cepat bila env wajib kosong.
8. Vitest + Playwright terpasang dengan 1 test contoh masing-masing. Script: dev, build, typecheck, lint, format, test, test:e2e, db:generate, db:migrate, db:seed.
9. GitHub Actions CI: install → typecheck → lint → test → build. Pastikan .gitignore berisi .env*, kecuali .env.example.
10. Siapkan git remote (saya beri URL repo bila diminta), commit "chore: initial project setup", push, dan pastikan preview Vercel berhasil build.
Verifikasi app jalan lokal (pnpm dev) dan halaman default render tanpa error konsol.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM:** CI hijau di GitHub, preview Vercel terbuka, tidak ada file `.env.local` di repo.

---

## P02 — Skema database & migrasi

```text
Kerjakan Development Step 2 bagian skema (T-04, T-05) PERSIS mengikuti docs/04-database/schema.md, indexes.md, constraints.md, relationships.md.

1. Tulis skema Drizzle per domain di src/lib/db/schema/{auth,donors,admin,campaigns,payments,notifications,system}.ts. Uang memakai bigint mode 'bigint'; waktu timestamptz; PK uuid (UUIDv7 dari aplikasi); ekstensi citext & pg_trgm.
2. Termasuk semua constraint finansial: partial unique index payment aktif per transaksi, unique (provider_id, provider_ref), unique (provider_id, provider_event_id), unique receipt_no, CHECK nominal & status/paid_at, FK ON DELETE RESTRICT untuk transaksi & payment.
3. Tabel campaign_disbursements hanya bila OD-06 = ya.
4. pnpm db:generate → periksa SQL hasil generate (tambahkan migrasi SQL manual untuk partial index/CHECK yang tidak didukung builder) → pnpm db:migrate ke branch Neon dev.
5. Role DB: buat skrip SQL scripts/db-roles.sql untuk app_migrator, app_rw (tanpa DELETE di transactions/payments/payment_events, audit_logs hanya INSERT/SELECT), app_ro. Jangan jalankan di production.
6. Integration test (tests/integration/db-constraints.test.ts) terhadap DB nyata: duplikat provider_ref ditolak, dua payment pending untuk satu transaksi ditolak, nominal < 1000 ditolak, delete campaign bertransaksi ditolak.
7. Bila kamu harus menyimpang dari schema.md, perbarui dokumennya dan jelaskan alasannya di laporan.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM:** migrasi dari DB kosong sukses; test constraint hijau.

---

## P03 — Seed data & skrip admin

```text
Kerjakan T-06 sesuai docs/04-database/seed-data.md.

1. scripts/seed.ts idempoten (upsert by unique key) dengan dua mode: `--reference` (kategori, roles, permissions, role_permissions sesuai BR-40, provider midtrans, payment_methods Midtrans: qris, gopay, shopeepay, bca_va, bni_va, bri_va, permata_va, cimb_va, mandiri_bill — is_active=false — dengan instruksi bayar Bahasa Indonesia per kanal, notification_templates Bahasa Indonesia, platform_settings) dan `--sample` (8 campaign campuran open/fixed & status, 12 berita, 40 donor fiktif example.com, 300 transaksi lintas status dengan payment & event sintetis). Mode sample menolak berjalan bila APP_ENV=production.
2. scripts/admin-create.ts: `pnpm admin:create --email <email> --name <nama> --role owner` → password acak 20 karakter ditampilkan sekali di terminal, must_change_password=true. Jangan menyimpan password di file.
3. Jalankan keduanya di DB dev. Verifikasi jumlah baris per tabel di laporan.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate):** jalankan `pnpm admin:create` sendiri untuk akunmu; simpan password di password manager.

---

## P04 — Login donatur Google

**Prasyarat:** `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` di `.env.local`; redirect URI terdaftar.

```text
Kerjakan Development Step 3 bagian donatur (T-09, T-10) sesuai F-09, F-10, AC-09.x, AC-10.x, docs/03-technical/security.md §2–3.

1. Auth.js v5 + Google provider + @auth/drizzle-adapter, sesi database (30 hari, rolling 24 jam), cookie __Secure- HttpOnly SameSite=Lax.
2. Tolak login bila email_verified Google false.
3. Saat login pertama: buat/ambil users dan donors (donors.user_id, email ternormalisasi). Klaim transaksi tamu BELUM dikerjakan (P18).
4. Halaman (auth)/masuk sesuai mockup donor-login: satu tombol "Lanjutkan dengan Google", state error. callbackUrl hanya path relatif internal (cegah open redirect).
5. requireDonor() di src/lib/auth (server-only) dipakai di layout (donor)/akun; tanpa sesi → redirect /masuk?callbackUrl=... . Middleware hanya lapisan pertama.
6. Logout menghapus sesi DB.
7. Test: unit callbackUrl sanitizer; e2e Playwright memakai sesi uji (seed session langsung ke DB, bukan Google nyata) untuk akses /akun, logout, akses tanpa sesi.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM:** login Google nyata di localhost berhasil; logout benar-benar keluar.

---

## P05 — Auth admin, RBAC, audit log

```text
Kerjakan T-11, T-12, T-13 sesuai F-22, BR-40–BR-42, AC-22.x, docs/03-technical/security.md §2.

1. Login admin terpisah di /admin/masuk (mockup admin-login): email + password (argon2id via @node-rs/argon2) + TOTP (otplib). TOTP wajib untuk role owner; setup TOTP pertama kali via QR (otpauth URL) setelah ganti password wajib.
2. Sesi di tabel admin_sessions (token acak 32 byte, simpan hash SHA-256), cookie __Host-tk_admin HttpOnly Secure SameSite=Strict, idle 30 menit, absolut 8 jam, rotasi setelah login.
3. Rate limit 5 percobaan / 15 menit per IP+email (Redis) + lockout akun 15 menit (failed_login_count, locked_until).
4. requireAdmin(permission) server-only: dipanggil di SETIAP layout/halaman/server action/route admin. Sesi donor tidak pernah memberi akses admin dan sebaliknya.
5. Helper writeAudit({actor, action, entityType, entityId, before, after, ip, ua}) + diff sederhana.
6. Halaman ganti password & setup TOTP; enkripsi totp_secret dengan AES-256-GCM memakai APP_ENCRYPTION_KEY.
7. Test: lockout, role editor ditolak akses transaksi (403), sesi donor ke /admin ditolak, sesi kedaluwarsa idle.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate M2):** login admin + TOTP di HP-mu berhasil; coba 6× password salah → terkunci.

---

## P06 — Layout publik & Home

```text
Kerjakan Development Step 4 langkah 1–2 (T-14, T-15; T-16 hanya bila OD-07 = ya) mengikuti mockup design-mockups/src/public/HomePage.tsx dan komponen di design-mockups/src/components. Gunakan shadcn/ui + token yang sudah dipasang; pindahkan komponen domain (CampaignCard, FundProgress, CategoryChips, Footer, PublicHeader, BottomNav) ke src/components/public sebagai komponen produksi.

1. Data dari DB lewat src/server/queries (bukan mock): campaign published, pilihan (is_featured), mendesak (end_at terdekat), statistik platform (cache Redis 5 menit), kategori (cache 1 jam).
2. RSC + ISR revalidate 60 dengan tag `campaigns`, `campaign:{slug}`.
3. Filter kategori lewat ?kategori= (slug valid saja), "Muat lebih banyak" dengan keyset pagination.
4. loading.tsx, error.tsx, empty state sesuai mockup. TANPA pop-up/modal otomatis (AC-01.3).
5. Metadata API: title/description unik, satu H1, canonical, Open Graph; sitemap.ts & robots.ts dasar.
6. Uji e2e: render, filter kategori, empty state (DB kosong), tanpa error konsol, tanpa overflow horizontal di 360/768/1280.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM:** bandingkan tampilan dengan mockup di HP sungguhan.

---

## P07 — Campaign Detail & News Detail

```text
Kerjakan T-17 dan T-18 (F-02, F-03, AC-02.x, AC-03.x) mengikuti mockup CampaignDetailPage.tsx dan NewsDetailPage.tsx.

1. /campaign/[slug]: galeri (next/image, alt dari DB), progres (tanpa target → tampilan "terkumpul · tanpa target"), sisa hari, jumlah donasi, deskripsi HTML yang sudah disanitasi, rincian penggunaan dana (dari campaign_disbursements bila OD-06 = ya; jika tidak, sembunyikan bagian itu), 3 berita terbaru, 10 donasi paid terbaru (nama tampil / "Hamba Allah", doa, waktu relatif Asia/Jakarta yang benar — tidak pernah "dari sekarang" untuk waktu lampau), sticky CTA mobile.
2. Status: paused/completed → CTA nonaktif + alasan; draft/archived → 404. Preview admin draft via token bertanda tangan (berlaku 1 jam).
3. Slug case-insensitive → redirect 301 ke slug kanonik.
4. /campaign/[slug]/berita/[newsSlug]: hanya news published milik campaign tersebut, kartu campaign terkait + CTA.
5. JSON-LD (Campaign: DonateAction/WebPage; News: NewsArticle), canonical, OG image = gambar utama.
6. Pastikan email/WA donatur TIDAK pernah ada di HTML (uji e2e dengan grep konten halaman).
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P08 — Checkout Form & createDonation

```text
Kerjakan T-19 (F-04, BR-03–BR-12, AC-04.1–AC-04.9) mengikuti mockup CheckoutFormPage.tsx (varian open & fixed).

1. /donasi/[slug] dengan FlowLayout + indikator langkah. Open: chip saran + input nominal (hanya digit, maks 13 digit, format ribuan, tanpa kehilangan presisi). Fixed: radio paket aktif sesuai sort_order. Data donatur: nama (wajib kecuali anonim), email (wajib), WA opsional + checkbox consent WA, doa ≤280, honeypot.
2. Donatur login: prefill nama/email/WA dari donors; email read-only.
3. Server action createDonation (src/server/actions/donations.ts):
   - Zod schema; nominal diparse ke bigint; untuk fixed abaikan amount dari client dan ambil dari campaign_amount_options (harus aktif & milik campaign).
   - Cek BR-03 (campaign menerima donasi), min/max campaign, batas platform.
   - Rate limit Redis 10/jam/IP & 5/jam/email (fail-open + log bila Redis down — OD-15).
   - Upsert donors by email (tamu) atau pakai donor sesi.
   - Insert transactions status created + snapshot + kode TK-... + access token 32 byte (simpan hash, kirim token mentah hanya di URL redirect).
   - Redirect ke /donasi/[slug]/pembayaran?trx=<code>&t=<token>.
4. Error inline per field + error umum dengan kode referensi (requestId).
5. Test: unit schema (nominal 13+ digit, huruf, < min, > max); integrasi manipulasi optionId paket campaign lain → 400; manipulasi amount fixed → nominal DB dipakai; e2e alur open & fixed sampai halaman pembayaran (halaman boleh masih placeholder).
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate M3):** coba ketik 9999999999999999 → tertahan 13 digit dan ditolak sesuai batas.

---

## P09 — Inti pembayaran: interface & state machine

```text
Kerjakan T-22 sesuai docs/03-technical/payment-architecture.md §2, §4, §5 dan BR-11, BR-17–BR-20. Provider MVP hanya Midtrans (OD-03), tetapi bangun abstraksinya.

1. src/lib/payments/types.ts: ProviderCode = 'midtrans', MethodType, PaymentStatus, CreatePaymentInput, PaymentInstruction, CreatePaymentResult, StatusResult, VerifiedWebhook, interface PaymentProvider (createPayment, getPaymentStatus, verifyWebhook, getPaymentInstructions, expirePayment).
2. Registry getProvider(code): hanya mengembalikan provider yang env-nya lengkap; provider tanpa kredensial = tidak terkonfigurasi (metodenya disembunyikan).
3. State machine canTransition(from, to) + tabel transisi; transisi ilegal dicatat sebagai anomali.
4. applyVerifiedStatus(tx, {paymentId, status, amount, paidAt, source, eventId}) — SATU fungsi untuk webhook, job, rekonsiliasi, tombol admin:
   - SELECT payments ... FOR UPDATE; tolak bila tidak ditemukan (unknown_payment) atau nominal beda (amount_mismatch, tidak paid, alert admin via notifikasi internal);
   - update payment; turunkan status transaksi;
   - bila paid: UPDATE transactions ... WHERE status <> 'paid' RETURNING; hanya bila baris kembali → increment campaigns.collected_amount & donor_count, nomor kuitansi dari receipt_counters (UPDATE ... RETURNING dalam transaksi yang sama, KW/YYYY/000001);
   - return hasil {changed, newStatus} untuk memicu notifikasi & revalidateTag di luar transaksi DB.
5. FakeProvider HANYA di tests/ (tidak diekspor dari src).
6. Test integrasi DB nyata: 5 panggilan paralel applyVerifiedStatus(paid) untuk payment yang sama → total campaign +1 kali, satu nomor kuitansi; expired setelah paid diabaikan; amount mismatch tidak paid.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P10 — Adapter Midtrans Core API

**Prasyarat:** `MIDTRANS_SERVER_KEY` sandbox (awalan `SB-Mid-server-`) dan `MIDTRANS_IS_PRODUCTION=false` di `.env.local`; metode yang akan dipakai sudah aktif di Dashboard Sandbox.

```text
Kerjakan T-23: src/lib/payments/midtrans/ (server-only) yang mengimplementasikan PaymentProvider.

PENTING: sebelum menulis kode, baca dokumentasi resmi terkini di docs.midtrans.com (Core API: Charge, Get Status, Expire, HTTP Notification). Jika ada perbedaan dengan catatan di bawah, dokumentasi resmi menang — catat perbedaannya di docs/03-technical/payment-architecture.md.

Catatan teknis (verifikasi ulang):
- Base URL: sandbox https://api.sandbox.midtrans.com, production https://api.midtrans.com (dipilih dari MIDTRANS_IS_PRODUCTION).
- Auth: header Authorization: Basic base64(SERVER_KEY + ":"), Accept & Content-Type application/json. Timeout 10 s, 1 retry hanya untuk error jaringan sebelum respons (bukan untuk 4xx).
- createPayment → POST /v2/charge dengan transaction_details.order_id = payments.id (UUID, idempotensi; order_id duplikat ditolak Midtrans), gross_amount integer rupiah, customer_details (first_name, email, phone), item_details 1 item (id = campaign id, name = judul campaign dipotong ≤50 karakter, price = nominal, quantity 1; total wajib sama dengan gross_amount), custom_expiry {order_time "yyyy-MM-dd HH:mm:ss +0700", expiry_duration, unit} dari payment_methods.expiry_minutes.
  Pemetaan metode internal → payment_type:
  • qris → payment_type "qris" (acquirer sesuai yang aktif di akun, mis. gopay) → simpan qr_string; QR dirender sendiri di server/client dari qr_string (jangan memuat gambar QR dari domain Midtrans).
  • gopay → "gopay" (+ callback_url) → actions: generate-qr-code, deeplink-redirect.
  • shopeepay → "shopeepay" (+ callback_url) → action deeplink-redirect.
  • bca_va / bni_va / bri_va / cimb_va → "bank_transfer" + bank_transfer.bank → va_numbers[0].va_number.
  • permata_va → "bank_transfer" bank "permata" → permata_va_number.
  • mandiri_bill → "echannel" (bill_info1/bill_info2) → biller_code + bill_key.
  Respons sukses pending umumnya status_code "201". Normalisasi ke PaymentInstruction {kind, bankName, vaNumber, billerCode, billKey, qrString, paymentUrl/deeplink, expiresAt}.
- getPaymentStatus → GET /v2/{order_id}/status.
- verifyWebhook → hitung SHA512(order_id + status_code + gross_amount + SERVER_KEY) dengan gross_amount persis string dari payload (mis. "100000.00"), bandingkan timing-safe dengan signature_key; LALU cross-check dengan getPaymentStatus dan gunakan status dari API sebagai kebenaran. eventId = transaction_id + transaction_status + status_code.
- Pemetaan status: settlement → paid; capture + fraud_status accept → paid; capture + challenge → pending (needs review); pending → pending; expire → expired; deny/failure → failed; cancel → cancelled; refund/partial_refund → refunded (dicatat, tanpa otomatis).
- expirePayment → POST /v2/{order_id}/expire (tangani 404/412 sebagai "sudah final", lalu cek status).
- Semua request/response disimpan ke payment_events (event_type create_request / status_check / expire_request / create_error) dengan redaksi: jangan simpan header Authorization atau server key.
- Kesalahan Midtrans (status_code 4xx/5xx, validation_messages) dipetakan ke error domain yang ramah donatur.

Test: unit pemetaan status & payment_type, signature (vektor uji buatan sendiri), normalisasi instruksi per metode (fixture JSON respons sandbox); integrasi opsional ke sandbox nyata ditandai @sandbox (dilewati di CI bila env kosong).
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P11 — Select Payment & createPayment

```text
Kerjakan T-20 dan T-25 (F-05, AC-05.x) mengikuti mockup SelectPaymentPage.tsx.

1. /donasi/[slug]/pembayaran?trx=&t=: validasi access token (hash cocok, belum kedaluwarsa) → ringkasan transaksi; tanpa token valid → 404.
2. Daftar metode dari payment_methods aktif milik provider terkonfigurasi (cache Redis 5 menit, invalidasi saat admin ubah), dikelompokkan QRIS / E-Wallet / Virtual Account, sembunyikan metode yang tidak mendukung nominal (min/max).
3. Server action createPayment: transaksi harus created/pending; bila ada payment pending lama dengan metode lain → expirePayment ke Midtrans dulu lalu tandai cancelled (BR-17); buat payments (id UUIDv7 = order_id) → provider.createPayment → simpan provider_ref (transaction_id Midtrans), instruksi, expires_at → status pending → enqueue notifikasi payment.pending (QStash; handler dibuat di P16, untuk sekarang cukup publish) → redirect ke /transaksi/[code]/instruksi?t=.
4. Klik ganda tidak membuat dua payment (lock Redis per transaksi 15 s + constraint DB).
5. Midtrans error/timeout → pesan ramah, transaksi tetap bisa dicoba lagi; error tercatat di payment_events.
6. Pastikan server key tidak pernah muncul di response/bundle (grep .next/static di laporan).
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P12 — Instruction, Success, Pending + endpoint status

```text
Kerjakan T-21 (F-06, F-07, F-08, AC-06.x, AC-07.x, AC-08.x) mengikuti mockup PaymentInstructionPage.tsx dan PaymentResultPages.tsx.

1. /transaksi/[code]/instruksi: VA (bank + nomor + salin), Mandiri Bill (kode perusahaan + kode bayar), QRIS (QR dari qr_string dirender sendiri + unduh PNG + nominal), GoPay/ShopeePay (tombol deeplink; di desktop tampilkan QR GoPay bila tersedia). Countdown dari expires_at, langkah bayar dari payment_methods.instructions (placeholder {{va_number}}, {{amount}}, {{bank_name}}), state expired & failed.
2. GET /api/transactions/[code]/status?t= → {status, paidAt} (no-store, rate limit). Halaman instruksi & pending polling tiap 5 s maks 10 menit lalu tombol "Cek status"; paid → redirect ke berhasil.
3. /transaksi/[code]/berhasil: hanya bila status DB paid (query string diabaikan, AC-07.1); ringkasan, tombol kuitansi (aktif setelah P19), ajakan login untuk tamu.
4. /transaksi/[code]/menunggu: target redirect callback e-wallet (callback_url Midtrans). Tidak mengubah status apa pun.
5. Access token di URL tidak boleh masuk log/analytics (redaksi di logger).
6. e2e: kunjungi berhasil?status=paid saat pending → diarahkan ke menunggu.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P13 — Webhook Midtrans

**Prasyarat:** URL publik untuk sandbox (deployment preview atau tunnel seperti `cloudflared`/`ngrok`). Set **Payment Notification URL** di Dashboard Sandbox → `https://<url>/api/webhooks/midtrans`.

```text
Kerjakan T-24 (F-17, AC-17.x) sesuai docs/03-technical/payment-architecture.md §5.

1. POST /api/webhooks/midtrans (runtime nodejs): baca raw body → insert payment_events (verification pending, payload ter-redaksi) → midtrans.verifyWebhook (signature + cross-check status API) → gagal: tandai rejected, balas 401 → dedup by (provider_id, provider_event_id): duplikat balas 200 → applyVerifiedStatus dalam DB transaction → tandai processed/ignored_transition/amount_mismatch/unknown_payment → di luar transaksi: publish notifikasi via QStash (dedup key event:trx:channel), revalidateTag campaign (throttle 10 s via Redis) → balas 200 cepat (<1 s p95).
2. Order_id yang tidak dikenal (mis. notifikasi tes dari dashboard) → simpan event, balas 200, jangan error.
3. Dukungan opsional header X-Override-Notification saat charge untuk environment preview (env MIDTRANS_NOTIFICATION_URL_OVERRIDE, hanya non-production).
4. Test integrasi: signature salah → 401 & status tetap; payload sama 5× paralel → total +1, satu notifikasi; settlement setelah expire → sesuai state machine; nominal beda → amount_mismatch.
5. Dokumentasikan cara uji manual dengan Midtrans Simulator (simulator.sandbox.midtrans.com) di docs/03-technical/payment-architecture.md.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P14 — Job expiry, cancel, rekonsiliasi, scheduler

```text
Kerjakan T-44 (F-18, AC-18.x, BR-15) dengan Upstash QStash. Semua endpoint /api/jobs/* wajib verifikasi signature QStash dan idempoten.

1. /api/jobs/expire-payments (tiap 5 menit): payment pending dengan expires_at + 5 menit < now → getPaymentStatus Midtrans → applyVerifiedStatus sesuai hasil (paid tetap diproses sebagai paid!). Batch 50, lanjutkan bila masih ada.
2. /api/jobs/cancel-stale (tiap jam): transaksi created tanpa payment > 24 jam → cancelled.
3. /api/jobs/reconcile (01:00 WIB): semua payment 48 jam terakhir dibandingkan dengan status Midtrans; selisih → audit_logs reconciliation.issue + email admin (EMAIL_ADMIN_ALERT); verifikasi juga collected_amount = SUM(paid) per campaign, laporkan selisih tanpa memperbaiki otomatis.
4. /api/jobs/campaign-scheduler (tiap 15 menit): published dengan end_at lewat → completed; revalidate.
5. Skrip scripts/qstash-schedules.ts untuk membuat/memperbarui schedule per environment (idempoten, berdasarkan APP_URL).
6. Tidak ada job yang menandai paid tanpa konfirmasi Midtrans.
7. Test integrasi dengan stub Midtrans (msw) untuk tiap job.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P15 — Uji E2E sandbox Midtrans

```text
Kerjakan T-27: suite Playwright tests/e2e/payments.sandbox.spec.ts (tag @sandbox) terhadap deployment preview yang Notification URL-nya mengarah ke preview tersebut.

Skenario: (1) open amount → QRIS → bayar via Midtrans Simulator → halaman berhasil + total campaign naik; (2) fixed amount → BCA VA → bayar via simulator; (3) Mandiri Bill; (4) GoPay deeplink (verifikasi pending + status via simulator); (5) VA dibiarkan → jalankan job expire secara manual (panggil endpoint dengan signature QStash uji) → kedaluwarsa; (6) ganti metode di tengah jalan → payment lama cancelled; (7) kirim ulang notifikasi yang sama dari dashboard → tidak dobel.
Kumpulkan bukti: tabel hasil, screenshot, dan cuplikan payment_events. Catat setiap perilaku Midtrans yang berbeda dari dokumen.
Akhiri dengan Laporan milestone sesuai CLAUDE.md, termasuk rekomendasi go/no-go untuk M4.
```

**Cek PM (Gate M4):** lakukan sendiri satu donasi QRIS di preview dan bayar lewat simulator; total campaign naik tepat sekali.

---

## P16 — Notifikasi inti + email Gmail

**Prasyarat:** `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `EMAIL_ADMIN_ALERT` di `.env.local`. Untuk lokal boleh pakai Mailpit.

```text
Kerjakan T-28, T-29, T-31 sesuai docs/03-technical/notification-architecture.md, F-19, BR-30–BR-32, AC-19.x.

1. Template engine: substitusi {{variabel}} dengan whitelist (donor_name, donor_email, donor_phone, campaign_title, transaction_id, donation_amount, payment_method, payment_status, payment_url, payment_instruction, created_at), escape HTML untuk email, validasi saat simpan menolak variabel tak dikenal.
2. Layout email HTML responsif (logo, warna brand, footer alamat lembaga) + versi teks.
3. Nodemailer transport smtp.gmail.com:465 secure, tanpa pool; counter harian di Redis + alert bila > 80% EMAIL_DAILY_LIMIT.
4. publishNotification(event, transactionId) → QStash ke /api/jobs/notify (dedup key event:trx). Handler: verifikasi signature → render template aktif per kanal → cek consent → kirim → notification_logs (queued/sent/failed/skipped, attempt, provider_response tanpa secret, payload dengan token akses diganti ***). Retry QStash 3×. Kegagalan tidak mengubah status pembayaran.
5. Sambungkan event: payment.pending (P11), payment.paid / failed / expired (P13–P14), receipt.issued (setelah P19 — siapkan hook-nya). donation.created mengikuti OD-10.
6. Test: render & escaping, variabel ilegal, dedup (dua job sama → satu email), SMTP gagal → failed + retry, status pembayaran tidak berubah.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P17 — WhatsApp Fonnte

```text
Kerjakan T-30 sesuai notification-architecture.md (WhatsApp) dan BR-26.

1. src/lib/whatsapp/fonnte.ts (server-only): POST FONNTE_API_URL dengan header Authorization: FONNTE_TOKEN, body target (E.164 tanpa '+', atau sesuai dokumentasi Fonnte terkini — verifikasi), message, countryCode 62. Simpan respons tanpa token.
2. Kirim hanya bila WHATSAPP_ENABLED, platform_settings notifications.whatsapp_enabled, consent di transaksi/profil, dan nomor valid. Selain itu log skipped dengan alasan.
3. Jeda minimal FONNTE_MIN_DELAY_MS antar pesan (QStash delay / flow control).
4. Template WA: payment.pending, payment.paid, payment.failed (teks singkat, tanpa link bertoken penuh kecuali payment_url pendek).
5. Test dengan msw; satu uji manual ke nomor dev (minta saya mengonfirmasi nomor sebelum mengirim).
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate M5):** kamu menerima email + WA untuk donasi sandbox; matikan opt-in → WA tidak terkirim.

---

## P18 — Donor dashboard & klaim transaksi tamu

```text
Kerjakan T-32, T-33, T-35 (F-11–F-13, F-15, AC-11.x–AC-15.x) mengikuti mockup DonorPages.tsx.

1. Klaim: saat sign-in (event Auth.js), tautkan transaksi tamu yang donor_email_snapshot sama persis (case-insensitive) dengan email Google terverifikasi → pindahkan ke donor akun; catat audit log; idempoten.
2. /akun: ringkasan (total paid, jumlah sukses, pending + ajakan lanjut bayar), 5 donasi terbaru, rekomendasi campaign.
3. /akun/donasi: filter status & tahun, paginasi 20, keyset.
4. /akun/donasi/[code]: detail, timeline status dari payments & events, tombol PDF (aktif setelah P19), kabar terbaru campaign.
5. /akun/profil: nama tampilan, WA (normalisasi +62), preferensi WA & anonim default; email read-only; tombol ajukan hapus akun (membuat permintaan + anonimisasi sesuai database-security.md §6, minta konfirmasi di halaman).
6. SEMUA query memfilter donorId dari sesi; transaksi orang lain → 404.
7. Test IDOR (ganti code di URL), klaim (email sama/berbeda), preferensi WA dihormati.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P19 — PDF transaksi & kuitansi

```text
Kerjakan T-34 (F-14, BR-27, BR-28, AC-14.x) dengan @react-pdf/renderer di runtime nodejs.

1. GET /api/donor/transactions/[code]/pdf?type=summary|receipt → requireDonor + ownership; receipt hanya status paid; header Content-Disposition attachment, Cache-Control: private, no-store.
2. Tamu: unduh kuitansi dari halaman berhasil memakai access token transaksi (berlaku 7 hari).
3. Desain kuitansi: identitas lembaga (platform_settings), nomor KW/YYYY/000001, tanggal bayar WIB, nama donatur (nama asli; tulis "Hamba Allah" hanya bila donatur memilih anonim), program, nominal angka + terbilang Bahasa Indonesia, metode, kode transaksi, penanda tangan, catatan "Dokumen ini dibuat secara elektronik". Font Plus Jakarta Sans tertanam.
4. Kuitansi immutable: simpan hash SHA-256 isi kuitansi saat terbit; render ulang memakai snapshot transaksi, bukan data profil terbaru.
5. Kirim event receipt.issued (lampiran PDF di email).
6. Test: fungsi terbilang (0 s.d. 1 miliar), non-paid → 404, donor lain → 404, header no-store.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate M6):** buka kuitansi PDF di HP dan laptop; periksa ejaan terbilang & identitas lembaga.

---

## P20 — Layout admin & dashboard

```text
Kerjakan T-36 (F-23, AC-23.x) mengikuti mockup AdminShell.tsx dan AdminDashboardPage.tsx.

1. Layout admin: sidebar (≥lg), drawer (mobile), topbar dengan pencarian global (kode transaksi/email/campaign), badge environment (Sandbox/Production dari MIDTRANS_IS_PRODUCTION), menu sesuai permission.
2. Dashboard: KPI (total paid, transaksi sukses, pending + potensi, total donatur, campaign aktif), grafik donasi harian (shadcn chart/Recharts), performa campaign, transaksi terbaru; filter 7/30/90 hari & rentang khusus; zona Asia/Jakarta.
3. Query agregat efisien (indeks yang ada; siapkan materialized view daily_donation_stats bila query > 300 ms di data seed besar).
4. Test: angka KPI = hasil query manual pada seed deterministik.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P21 — Admin campaign & berita

```text
Kerjakan T-37 dan T-38 (F-24, F-25, BR-01–BR-07, AC-24.x, AC-25.x) mengikuti mockup CampaignAdminPages.tsx.

1. Daftar campaign: filter status/kategori/tipe nominal, cari judul (trigram), paginasi.
2. Editor campaign: judul, slug (auto + edit, unik), kategori, ringkasan, deskripsi rich text (TipTap; sanitize-html whitelist saat simpan), gambar utama + galeri (upload ke penyimpanan OD-12, validasi magic bytes, maks 2 MB, konversi WebP, alt WAJIB, urutkan), tipe nominal (open: min, max, saran ≤6; fixed: paket CRUD, aktif/nonaktif, urutkan drag; paket yang sudah dipakai transaksi tidak bisa dihapus), target opsional, jadwal mulai/akhir, featured, SEO + pratinjau Google, status (publish/pause/complete/archive dengan validasi BR-02), preview draft.
3. Hapus permanen hanya draft tanpa transaksi; selain itu arsip.
4. Berita: daftar + editor (campaign, judul, slug unik per campaign, ringkasan, rich text, gambar + alt, SEO, simpan draf/terbitkan → published_at), soft delete.
5. Rincian penyaluran dana (campaign_disbursements) hanya bila OD-06 = ya: form tambah penyaluran (finance) + tautan ke berita bukti.
6. Semua aksi: requireAdmin(permission sesuai BR-40) + audit log diff + revalidateTag.
7. Test: validasi publish, paket nonaktif tidak muncul di checkout, editor tanpa permission publish ditolak, XSS di deskripsi tersanitasi.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P22 — Admin keuangan: metode, transaksi, donatur, log, audit

```text
Kerjakan T-39, T-40, T-41, T-43 (F-26–F-30, AC-26.x–AC-30.x) mengikuti mockup FinanceAdminPages.tsx dan AdminMiscPages.tsx.

1. Metode Pembayaran: kartu status Midtrans (terkonfigurasi/tidak, Sandbox/Production, webhook terakhir diterima, tombol "Tes koneksi" yang memanggil GET status order fiktif dan menilai respons auth) — kredensial TIDAK pernah dikirim ke browser. Daftar metode: aktif/nonaktif, urutan drag, nama tampil, logo, min/max, masa berlaku, biaya (OD-04), instruksi per kanal (editor markdown dengan placeholder). Invalidasi cache Redis setelah simpan.
2. Transaksi: filter status/tanggal/campaign/metode, cari kode/nama/email/WA, kartu ringkasan, detail (percobaan bayar, payment events, notifikasi, donatur), tombol "Cek status ke Midtrans" (permission transactions.reconcile → applyVerifiedStatus). TIDAK ADA tombol tandai lunas.
3. Ekspor CSV transaksi & donatur sesuai filter: streaming; > 10.000 baris diproses via QStash lalu tautan unduh bertanda tangan 1 jam; dicatat di audit log; permission export.
4. Donatur: daftar (akun/tamu, total, jumlah, terakhir), panel detail & riwayat; nomor/email dimasking sebagian kecuali permission donors.export.
5. Log Pembayaran: payment_events dengan filter & detail JSON ter-redaksi.
6. Audit log: read-only dengan filter aktor/aksi/entitas.
7. Test otorisasi tiap halaman & aksi per role; CSV mengikuti filter; tidak ada endpoint yang bisa mengubah status ke paid.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P23 — Admin template & log notifikasi

```text
Kerjakan T-42 (F-20, F-21, AC-20.x, AC-21.x) mengikuti mockup NotificationAdminPages.tsx.

1. Template: daftar per kanal (Email/WhatsApp), editor subjek & isi, sisipkan variabel, satu template aktif per event+kanal (aktifkan satu → nonaktifkan lainnya dalam transaksi), versi (version + 1 setiap simpan), pratinjau dengan data contoh (email dalam layout; WA dalam gelembung chat), kirim tes hanya ke email/nomor admin yang login (is_test = true).
2. Log notifikasi: filter kanal/status/template, cari kode transaksi/penerima, penerima dimasking, respons provider, tombol kirim ulang (membuat log baru, tetap dedup untuk event finansial yang sudah sent kecuali admin memilih "kirim ulang paksa" dengan alasan → audit log).
3. Test: variabel ilegal ditolak, test send tidak ke donatur, kirim ulang tercatat.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate M7):** login sebagai role editor & finance (buat akun uji) dan pastikan menu/aksi sesuai tabel BR-40.

---

## P24 — Performa, SEO, cache

```text
Kerjakan T-46 dan NFR-01–NFR-04, NFR-15 sesuai docs/03-technical/performance.md.

1. Ukur Lighthouse mobile (Home, Campaign Detail, Checkout) di preview; target LCP ≤2,5 s, CLS ≤0,1, JS first-load publik ≤150 KB gzip. Perbaiki: next/image sizes & priority, font subset, pecah client component, hapus dependensi berat.
2. Cache Redis untuk daftar & statistik sesuai performance.md; throttle revalidateTag saat ramai.
3. SEO: metadata unik semua halaman publik, JSON-LD tervalidasi, sitemap dinamis (campaign & news published), robots (blokir /admin, /akun, /transaksi, /donasi/*/pembayaran), canonical, OG image.
4. Lighthouse CI di GitHub Actions dengan assert budget.
5. Vercel Speed Insights aktif.
Akhiri dengan Laporan milestone sesuai CLAUDE.md, sertakan angka sebelum/sesudah.
```

---

## P25 — Hardening & review keamanan

```text
Gunakan agent security-reviewer untuk review penuh, lalu perbaiki temuan (T-45, T-48) sesuai docs/03-technical/security.md.

1. Header: CSP dengan nonce (izinkan hanya domain yang dibutuhkan: Google OAuth, penyimpanan gambar, Vercel insights), HSTS, X-Frame-Options DENY/frame-ancestors 'none', Referrer-Policy, Permissions-Policy; serverActions.allowedOrigins.
2. Cek bundle: grep .next/static untuk SB-Mid-server, Mid-server, GMAIL, FONNTE, DATABASE_URL — harus nol.
3. Pastikan setiap server action & route punya guard (tambahkan test meta yang memindai file actions/route untuk pemanggilan requireAdmin/requireDonor/verifikasi signature).
4. Uji: IDOR transaksi/PDF, webhook palsu, QStash tanpa signature, rate limit checkout & login, upload file berbahaya (SVG/HTML berganti ekstensi), XSS di doa/nama/deskripsi.
5. pnpm audit tanpa high/critical; gitleaks di CI.
6. Tulis laporan temuan (severity, file:baris, skenario, perbaikan) ke docs/03-technical/security-review-<tanggal>.md. Semua blocker/high harus tertutup.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P26 — QA regresi penuh

```text
Gunakan agent qa-engineer. Jalankan seluruh docs/05-roadmap/testing-plan.md (22 skenario) + semua AC P0 di acceptance-criteria.md.

1. Lengkapi test yang belum ada; beri nama test dengan ID AC.
2. Jalankan unit, integrasi (DB nyata), e2e (termasuk @sandbox Midtrans di preview), responsif 360/768/1280, axe aksesibilitas, cek konsol & network error di setiap e2e.
3. k6 load test ringan ke preview: 200 checkout/menit selama 5 menit (hanya sampai createDonation, tanpa charge Midtrans) + homepage 50 rps.
4. Buat matriks AC → test → hasil di docs/05-roadmap/test-report-<tanggal>.md, daftar bug dengan severity, dan rekomendasi go/no-go.
Jangan skip test yang gagal; laporkan sebagai blocker.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate M8):** baca test report; semua blocker tertutup sebelum P27.

---

## P27 — Persiapan produksi Midtrans

**Prasyarat:** akun **Midtrans Production** sudah aktif; metode yang disetujui merchant sudah diketahui; domain siap.

```text
Siapkan rilis produksi sesuai docs/03-technical/deployment.md dan docs/05-roadmap/release-checklist.md. Saya yang memasukkan secret ke Vercel; kamu menyiapkan semua yang lain dan memberi saya checklist langkah manual.

1. Daftar env Production yang wajib diisi (tanpa nilai): MIDTRANS_SERVER_KEY (production, awalan Mid-server-), MIDTRANS_IS_PRODUCTION=true, APP_URL domain, AUTH_URL, DATABASE_URL Neon main, Upstash prod, QStash, Gmail, Fonnte, APP_ENCRYPTION_KEY baru (jangan pakai ulang dev). Tambahkan pengecekan env saat build: production gagal build bila MIDTRANS_IS_PRODUCTION=true tetapi key berawalan SB-.
2. Langkah manual untuk saya di Dashboard Midtrans Production: Payment Notification URL = https://<domain>/api/webhooks/midtrans; Finish/Unfinish/Error redirect URL ke /transaksi/... (hanya UX); aktifkan metode sesuai persetujuan; catat metode yang tidak aktif → nonaktifkan di admin.
3. Workflow migrasi produksi (GitHub Action manual dispatch): snapshot/branch Neon → db:migrate → seed --reference.
4. qstash-schedules untuk production.
5. Domain & redirect www, OAuth Google: tambahkan redirect URI produksi & publish consent screen.
6. Smoke test @smoke terhadap production (tanpa pembayaran): home, campaign, checkout sampai Select Payment, login Google, admin login.
7. Rencana rollback tertulis.
Akhiri dengan Laporan milestone sesuai CLAUDE.md + checklist manual yang harus saya centang.
```

---

## P28 — Go-live & laporan penyelesaian

```text
Kita go-live. Bantu saya menjalankan dan memverifikasi transaksi nyata nominal kecil, lalu buat Development Completion report.

1. Pandu saya melakukan donasi nyata Rp10.000 untuk setiap metode utama yang aktif (QRIS, satu e-wallet, satu VA, Mandiri Bill bila aktif). Saya yang membayar dari perangkat saya.
2. Untuk tiap transaksi verifikasi: payment_events webhook verified/processed, status paid, total campaign naik sekali, email & WA diterima, kuitansi PDF benar, tampil di dashboard donatur dan admin.
3. Pantau 24 jam pertama: error log, webhook rejected, notifikasi failed, rekonsiliasi malam pertama.
4. Tulis docs/DEVELOPMENT-COMPLETION.md: daftar fitur terimplementasi, hasil test, URL produksi, checklist konfigurasi environment, isu diketahui, sisa tugas, penilaian kesiapan produksi.
5. Perbarui README.md (status: Production) dan CLAUDE.md (fase: Phase 3 — Publishing, menunggu persetujuan).
Jangan mempublikasikan apa pun ke publik sebelum saya menyetujui.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate):** setujui go-live publik.

---

## P29 — Landing page brief (Phase 3)

```text
Phase 3 — Publishing & Marketing dimulai (disetujui <tanggal>). Kerjakan H1 bagian brief.

Buat marketing/landing-page-brief.md dalam Bahasa Indonesia yang natural, berdasarkan produk yang sudah live (baca docs/02-product/PRD.md, data campaign nyata di DB produksi via query read-only, dan fitur yang benar-benar ada). Isi: positioning, target audiens, value proposition, USP, kepribadian brand, hierarki pesan, hero headline + subheadline (3 alternatif), CTA, elemen kepercayaan (hanya yang bisa dibuktikan: legalitas yayasan, pembayaran via Midtrans, laporan penyaluran, kuitansi otomatis), How It Works, showcase campaign, manfaat platform, bagian transparansi, FAQ (≥8, termasuk biaya, keamanan pembayaran, kuitansi, donasi tanpa akun), footer, kata kunci SEO, meta title (≤60) & meta description (≤160).
Buat juga marketing/landing-page-implementation-brief.md: struktur section, komponen dari design system, data dinamis yang dipakai, tracking event, kriteria penerimaan.
Larangan: klaim tanpa bukti (angka donatur/penyaluran harus dari DB atau ditulis sebagai placeholder yang jelas), testimoni karangan.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

**Cek PM (Gate):** setujui headline, klaim kepercayaan, dan FAQ.

---

## P30 — Implementasi landing page

```text
Implementasikan landing page sesuai marketing/landing-page-implementation-brief.md yang sudah saya setujui, memakai design system produksi (Next.js, shadcn, token yang sama).
- Route: <"/" menggantikan home | "/tentang-platform"> (pilih sesuai keputusan saya: <isi>).
- Semua copy dari brief, tanpa lorem ipsum. Statistik & campaign showcase dari DB (cache), bukan angka tetap.
- SEO metadata + JSON-LD Organization & FAQPage, OG image dinamis.
- Lighthouse mobile ≥90 performa, aksesibilitas ≥95; responsif 360/768/1280; konsol bersih.
- Event analytics: klik CTA hero, klik campaign, mulai donasi.
Commit, deploy preview, kirim URL preview untuk saya review sebelum merge ke main.
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P31 — Paket Instagram: profil, feed, carousel

```text
Kerjakan H2 bagian 1–3. Tulis ke marketing/instagram/: brand-guidelines.md, profile.md, feed-posts.md, carousel-posts.md, image-prompts.md. Bahasa Indonesia natural, konsisten dengan design system (zamrud, emas lembut, krem; motif geometri halus; Plus Jakarta Sans/Fraunces).

1. brand-guidelines.md: suara & nada, kosakata (program, donasi, Hamba Allah), do/don't, palet, tipografi, aturan foto (wajah penerima manfaat hanya dengan izin, hindari eksploitasi kesedihan), dimensi 1080×1080, 1080×1350, 1080×1920.
2. profile.md: konsep foto profil + prompt generator gambar, 5 saran username (cek ketersediaan manual oleh saya), display name, bio ≤150 karakter, CTA, strategi link-in-bio (tautan ke landing, campaign utama, laporan penyaluran).
3. feed-posts.md: 5 post peluncuran — tujuan, konsep visual, prompt gambar (siap dipakai di Grok/Claude/alat lain; tanpa wajah publik figur nyata, tanpa logo pihak lain), headline, caption, CTA, hashtag (campuran luas & niche, ≤15), alt text.
4. carousel-posts.md: 5 carousel — headline cover, isi tiap slide (≤7 slide), arahan visual, prompt gambar, caption, CTA, hashtag. Topik usulan: cara donasi 3 langkah, transparansi dana, kenapa kuitansi penting, kisah program nyata (dari berita yang sudah terbit), FAQ keamanan pembayaran.
5. image-prompts.md: kumpulan semua prompt gambar dengan ID, rasio, dan negative prompt.
Klaim harus bisa dibuktikan; angka diambil dari data nyata atau ditandai [ISI DATA].
Akhiri dengan Laporan milestone sesuai CLAUDE.md.
```

---

## P32 — Reels, voiceover, kalender konten

```text
Kerjakan H2 bagian 4–5. Tulis marketing/instagram/reels-script.md, elevenlabs-voiceover.md, content-calendar.md.

1. reels-script.md: 1 Reels peluncuran 30–45 detik — konsep, hook 3 detik pertama, storyboard per adegan (durasi, visual, teks layar, transisi), prompt visual per adegan, naskah voiceover Bahasa Indonesia natural, subtitle, arahan musik latar (bebas royalti, tenang-hangat), instruksi editing (rasio 9:16, safe zone teks), caption, CTA, hashtag, desain cover.
2. elevenlabs-voiceover.md: naskah final dengan penanda jeda, arahan suara (gender/usia/nada hangat, tempo), pengaturan yang disarankan (stability, similarity, style), versi 30 dtk & 15 dtk, catatan pelafalan istilah Arab (sedekah, jazakallah khairan).
3. content-calendar.md: kalender 14 hari mulai <tanggal launch> — tanggal/hari, format (feed/carousel/reels/story), topik, tujuan, status caption, status produksi; jadwal jam posting yang disarankan (WIB) dengan alasan.
Akhiri dengan Laporan milestone sesuai CLAUDE.md, berisi daftar aset yang perlu diproduksi manual.
```

**Cek PM (Gate):** setujui materi sebelum diunggah. Mengunggah ke Instagram dilakukan oleh tim, bukan oleh agent.

---

## Prompt pemulihan & bantuan

### R1 — Lanjutkan pekerjaan (sesi baru / konteks hilang)
```text
Lanjutkan proyek Tebar Kebaikan. Baca CLAUDE.md, AGENTS.md, docs/05-roadmap/prompt-playbook.md, dan git log -20. Tentukan prompt playbook terakhir yang selesai (cek laporan di commit/PR dan docs), lalu laporkan: status sekarang, pekerjaan yang setengah jadi, test yang gagal. Jangan menulis kode sampai saya konfirmasi prompt mana yang dilanjutkan.
```

### R2 — Test gagal / build merah
```text
CI/test gagal. Jangan menonaktifkan atau melewati test. Reproduksi kegagalan secara lokal, cari akar masalah, jelaskan penyebabnya dalam 3–5 kalimat, perbaiki dengan perubahan minimal, jalankan ulang seluruh suite terkait, lalu buat Laporan milestone singkat.
```

### R3 — Debug pembayaran Midtrans
```text
Ada masalah pembayaran: <gejala, kode transaksi TK-..., waktu>. Investigasi read-only dulu: transactions, payments, payment_events (urutkan waktu), notification_logs, log Vercel untuk /api/webhooks/midtrans. Panggil GET status Midtrans untuk order_id terkait (sandbox/production sesuai env). Jelaskan kronologi, apakah status DB sesuai Midtrans, dan usulan perbaikan. Jangan mengubah data finansial secara manual; bila status perlu disinkronkan, gunakan alur "Cek status ke Midtrans" (applyVerifiedStatus) dan catat di audit log.
```

### R4 — Permintaan perubahan scope
```text
Saya ingin menambah/mengubah: <deskripsi>. Jangan langsung koding. Gunakan agent product-analyst: tulis usulan di docs/02-product/proposals/<tanggal>-<nama>.md (masalah, nilai, dampak ke PRD/TRD/ERD, estimasi, risiko, prompt playbook yang terpengaruh). Tunggu persetujuan saya.
```

### R5 — Review sebelum merge
```text
Review PR/branch saat ini sebelum merge: jalankan typecheck, lint, test; minta security-reviewer memeriksa perubahan yang menyentuh auth, pembayaran, atau data donatur; cek kesesuaian dengan acceptance criteria terkait. Laporkan temuan dengan severity. Jangan merge sendiri.
```

### R6 — Rollback produksi
```text
Produksi bermasalah: <gejala>. Langkah: (1) ringkas dampak dari log, (2) usulkan rollback Vercel ke deployment sebelumnya beserta risikonya terhadap skema DB, (3) tunggu persetujuan saya, (4) setelah rollback jalankan smoke test @smoke dan rekonsiliasi Midtrans 24 jam terakhir, (5) tulis postmortem di docs/postmortems/<tanggal>.md.
```
