# Functional Requirements

Setiap fitur memuat: Deskripsi · Peran · Prasyarat · Alur utama · Alur alternatif · Validasi · Error state · Acceptance criteria (AC ringkas; daftar lengkap di acceptance-criteria.md). Aturan bisnis dirujuk sebagai `BR-xx`.

---

## A. Halaman Publik

### F-01 Home Page
- **Deskripsi:** Beranda menampilkan hero (≤3 slide statis yang dikelola admin via campaign `is_featured`), campaign pilihan, filter kategori, daftar campaign terbaru (paginasi "Muat lagi"), blok kepercayaan (total donasi tersalurkan, jumlah donatur), tautan "Lihat semua campaign" ke `/campaign` (F-31), footer dengan tautan halaman legal (F-32).
- **Peran:** Publik.
- **Prasyarat:** Ada ≥0 campaign `published`.
- **Alur utama:** 1) Buka `/` → 2) lihat hero & campaign pilihan → 3) pilih kategori (chip) → daftar ter-filter tanpa reload penuh → 4) klik kartu → Campaign Detail.
- **Alternatif:** Tidak ada campaign → empty state "Program kebaikan segera hadir". Kategori tanpa campaign → empty state per kategori.
- **Validasi:** Parameter `?kategori=` harus slug kategori aktif; jika tidak, abaikan dan tampilkan semua.
- **Error:** Gagal ambil data → error state dengan tombol "Coba lagi"; hero tetap tampil dari cache.
- **AC:** AC-01.1–AC-01.5.

### F-02 Campaign Detail Page
- **Deskripsi:** Galeri, judul, kategori, terkumpul vs target (atau "Tanpa target"), sisa hari (atau "Berlangsung"), jumlah donatur, CTA "Donasi Sekarang" (sticky di mobile), ringkasan & deskripsi lengkap (rich text), rincian penggunaan dana (rincian penyaluran, F-33), berita terkait (3 terbaru), donatur terbaru (10), tombol bagikan.
- **Peran:** Publik.
- **Prasyarat:** Campaign status `published`, `paused`, atau `completed`.
- **Alur utama:** Buka `/campaign/[slug]` → baca → klik "Donasi Sekarang" → Checkout Form.
- **Alternatif:** `paused` → CTA nonaktif + label "Donasi sementara dijeda". `completed` atau `end_at` lewat → CTA nonaktif + "Program telah selesai". `draft`/`archived` → 404. Admin login dapat preview draft via `?preview=` token.
- **Validasi:** Slug lowercase-kebab; lookup case-insensitive dan redirect 301 ke slug kanonik.
- **Error:** 404 halaman tidak ditemukan; gagal memuat donatur → section disembunyikan, halaman tetap tampil.
- **AC:** AC-02.1–AC-02.6.

### F-03 News Detail Page
- **Deskripsi:** Judul, tanggal publikasi, gambar utama, konten rich text, kartu campaign terkait + CTA donasi, berita lain dari campaign yang sama.
- **Peran:** Publik.
- **Prasyarat:** News `published` dan campaign induk tidak `draft`/`archived`.
- **Alur utama:** Dari Campaign Detail → klik berita → baca → CTA donasi.
- **Alternatif:** News draft → 404 (kecuali preview admin).
- **Validasi:** Kombinasi slug campaign + slug news harus cocok.
- **Error:** 404.
- **AC:** AC-03.1–AC-03.3.

### F-04 Checkout Form Page
- **Deskripsi:** Satu layar: pilih nominal + data donatur + persetujuan.
  - **Open amount:** chip saran nominal (dari admin) + input custom dengan format ribuan.
  - **Fixed amount:** radio card paket aktif sesuai urutan.
  - Data donatur: Nama (wajib kecuali anonim), Email (wajib — untuk kuitansi), No. WhatsApp (opsional), toggle "Sembunyikan nama saya (Hamba Allah)", Doa/pesan (opsional, ≤280 karakter), checkbox "Kirim notifikasi WhatsApp" (hanya muncul bila nomor diisi & fitur WA aktif).
  - Jika login: nama, email, nomor terisi otomatis dari profil.
- **Peran:** Publik (tamu/login).
- **Prasyarat:** Campaign dapat menerima donasi (BR-03).
- **Alur utama:** Pilih nominal → isi data → "Lanjut Pilih Pembayaran" → server action `createDonation` memvalidasi (Zod) & rate limit → membuat `transactions` status `created` dengan snapshot campaign & donatur → redirect ke Select Payment.
- **Alternatif:** Campaign berubah status antara load dan submit → error "Program tidak lagi menerima donasi". Nominal di luar batas → pesan inline.
- **Validasi:** BR-05..BR-09 (min/max, integer, paket aktif milik campaign), email RFC, WA format E.164 Indonesia (`+62`/`08` dinormalisasi), honeypot field, rate limit 10 transaksi/jam/IP & 5/jam/email.
- **Error:** Validasi inline per field; error server umum dengan ID referensi; rate limit → "Terlalu banyak percobaan, coba lagi nanti".
- **AC:** AC-04.1–AC-04.9.

### F-05 Select Payment Page
- **Deskripsi:** Ringkasan donasi (campaign, nominal) + daftar metode aktif dikelompokkan (QRIS, E-Wallet, Virtual Account, Lainnya), urut `display_order`, dengan logo & biaya (jika dibebankan, BR-13).
- **Peran:** Pemilik transaksi (token akses).
- **Prasyarat:** Transaksi status `created`; belum ada payment `pending` aktif.
- **Alur utama:** Pilih metode → "Bayar Sekarang" → server memanggil `provider.createPayment()` → simpan `payments` (status `pending`, `provider_ref`, instruksi, `expires_at`) → transaksi `pending` → redirect Payment Instruction → notifikasi "Payment Pending".
- **Alternatif:** Ganti metode sebelum bayar: transaksi pending dapat membuat payment baru; payment lama di-`expirePayment()` dan ditandai `cancelled` (BR-17). Midtrans gagal/timeout → pesan ramah, transaksi tetap `created`, donatur dapat mencoba lagi (fallback antar-provider BR-16 nonaktif di MVP).
- **Validasi:** Metode harus aktif, milik provider yang terkonfigurasi, dan mendukung nominal (min/max metode).
- **Error:** Timeout provider → "Gagal membuat pembayaran, silakan pilih ulang" + log; tidak ada payment ganda (idempotency key = `payment.id`).
- **AC:** AC-05.1–AC-05.6.

### F-06 Payment Instruction Page
- **Deskripsi:** Nominal (dengan tombol salin), countdown kedaluwarsa, instruksi sesuai tipe: VA (bank + nomor + salin), QRIS (gambar QR + unduh), e-wallet (tombol deeplink/redirect URL), kode bayar (retail). Langkah bayar dari `payment_methods.instructions` (accordion per kanal: m-banking, ATM, internet banking). Status di-poll tiap 5 s (maks 10 menit, lalu tombol "Cek status").
- **Peran:** Pemilik transaksi.
- **Prasyarat:** Payment `pending`.
- **Alur utama:** Donatur bayar → webhook → status `paid` → halaman otomatis redirect ke Success.
- **Alternatif:** Payment `expired` → tampil state kedaluwarsa + "Buat pembayaran baru". `failed` → state gagal + pilih metode lain.
- **Validasi:** Token akses transaksi valid.
- **Error:** Polling gagal → status terakhir tetap tampil + pesan koneksi.
- **AC:** AC-06.1–AC-06.6.

### F-07 Payment Success Page
- **Deskripsi:** Ucapan terima kasih + doa, ringkasan (kode, campaign, nominal, metode, waktu bayar), unduh kuitansi PDF, bagikan campaign, ajakan login Google untuk menyimpan riwayat (jika tamu).
- **Prasyarat:** Transaksi `paid` (diverifikasi server, bukan query string).
- **Alternatif:** Diakses saat belum paid → redirect ke Pending/Instruction.
- **AC:** AC-07.1–AC-07.4.

### F-08 Payment Pending Page
- **Deskripsi:** Status "Menunggu pembayaran" untuk donatur yang kembali dari redirect provider (e-wallet) sebelum webhook tiba; tombol "Lihat instruksi", "Cek status", auto-poll.
- **Prasyarat:** Transaksi `pending`.
- **Alternatif:** Jika sudah `paid` → redirect Success; `expired/failed` → state terkait.
- **AC:** AC-08.1–AC-08.3.

---

## B. Auth Donatur

### F-09 Login Google
- **Deskripsi:** Halaman `/masuk` dengan tombol "Lanjutkan dengan Google". Akun dibuat otomatis saat login pertama (users + donors).
- **Alur utama:** Klik → OAuth Google → callback → buat/ambil user → sesi DB (cookie httpOnly) → redirect `callbackUrl` (whitelist path internal) atau `/akun`.
- **Alternatif:** User membatalkan → kembali ke `/masuk` dengan pesan. Email Google tidak terverifikasi → tolak login.
- **Validasi:** `state` + PKCE (Auth.js), `callbackUrl` hanya path relatif.
- **Error:** Gagal OAuth → pesan umum + log.
- **AC:** AC-09.1–AC-09.4.

### F-10 Sesi & Logout
- Sesi database 30 hari, rolling 24 jam; logout menghapus sesi server & cookie; semua route `/akun/**` diproteksi di server (layout + data access), bukan hanya middleware.
- **AC:** AC-10.1–AC-10.3.

### F-11 Klaim transaksi tamu
- **Deskripsi:** Saat login, transaksi tamu dengan `donor_email` sama persis (case-insensitive, setelah normalisasi) dengan email Google **terverifikasi** ditautkan ke donor akun.
- **Alternatif:** Email berbeda → transaksi tetap tamu; donatur dapat menautkan via tautan magic yang dikirim ke email transaksi (P1, lihat Open Decisions).
- **Validasi:** Hanya klaim bila `email_verified = true` dari Google.
- **AC:** AC-11.1–AC-11.3.

---

## C. Donor Dashboard

### F-12 Ringkasan dashboard
Kartu: Total donasi (sum `paid`), jumlah transaksi sukses, pending; 5 transaksi terbaru; CTA campaign rekomendasi. **AC-12.x**

### F-13 Riwayat & detail transaksi
List dengan filter status & tahun, paginasi 20; detail: kode, campaign, nominal, metode, status timeline (created → pending → paid), waktu, tombol PDF. Query selalu `WHERE donor_id = session.donorId`. Akses transaksi orang lain → 404 (bukan 403, untuk menghindari enumerasi). **AC-13.x**

### F-14 Unduh PDF
- **PDF Transaksi:** ringkasan transaksi apa pun statusnya.
- **Kuitansi Donasi:** hanya untuk `paid`, nomor kuitansi unik berurutan per tahun (`KW/2026/000123`), dibuat sekali (immutable) dan disimpan hash-nya.
- Digenerate server-side di Route Handler setelah otorisasi; `Cache-Control: private, no-store`. **AC-14.x**

### F-15 Profil donatur
Ubah nama tampilan, nomor WhatsApp, preferensi notifikasi (email transaksional selalu aktif; WA opt-in), default anonim. Email dari Google read-only. **AC-15.x**

---

## D. Pembayaran

### F-16 Abstraksi provider & pembuatan pembayaran
Interface `PaymentProvider` (createPayment, getPaymentStatus, verifyWebhook, getPaymentInstructions, expirePayment). Adapter **Midtrans Core API** (satu-satunya provider MVP, OD-03); interface tetap memungkinkan provider lain kelak. Pemilihan provider per `payment_methods.provider_id`. Biaya gateway ditanggung lembaga (OD-04, BR-13): `payments.amount` = nominal donasi, tanpa biaya tambahan ke donatur. Detail: ../03-technical/payment-architecture.md. **AC-16.x**

### F-17 Webhook
Endpoint `/api/webhooks/{provider}`: simpan raw event (`payment_events`) → verifikasi (signature Midtrans SHA512 + cross-check `GET /v2/{order_id}/status`) → dedup (`unique(provider, event_id)`) → transisi status dalam satu DB transaction dengan state machine (BR-20) → increment total campaign hanya pada transisi pertama ke `paid` → enqueue notifikasi via QStash → respon 200. **AC-17.x**

### F-18 Expiry & rekonsiliasi
- QStash schedule tiap 5 menit: payment `pending` yang lewat `expires_at` + 5 menit → cek `getPaymentStatus()` → bila provider menyatakan expired/tidak dibayar → `expired`; bila provider menyatakan paid → proses seperti webhook.
- Rekonsiliasi harian 01:00 WIB: bandingkan semua payment 48 jam terakhir dengan provider; selisih → `reconciliation_issues` di audit log + notifikasi admin.
- Job tidak pernah menandai `paid` tanpa konfirmasi provider. **AC-18.x**

---

## E. Notifikasi

### F-19 Pengiriman notifikasi
Event: `donation.created` (**nonaktif**, OD-10; template di-seed `is_active = false`), `payment.pending`, `payment.paid`, `payment.failed`, `payment.expired`, `receipt.issued`. Setiap event → QStash job → render template aktif per kanal → kirim (Nodemailer/Fonnte) → log. Retry eksponensial 3× (QStash). Kegagalan notifikasi tidak mengubah status pembayaran. WA hanya bila `whatsapp_opt_in = true` dan nomor valid. **AC-19.x**

### F-20 Manajemen template
CRUD template per (event, kanal); satu template aktif per kombinasi; editor subject (email) + body (HTML untuk email, teks untuk WA); daftar variabel yang diizinkan; preview dengan data contoh; kirim tes ke alamat/nomor admin. Variabel tidak dikenal → validasi gagal saat simpan. **AC-20.x**

### F-21 Log notifikasi
Tabel: kanal, penerima (dimasking sebagian di UI), template, transaksi, status, respon provider, error, waktu kirim; filter & detail; tombol "Kirim ulang" (membuat log baru). **AC-21.x**

---

## F. Admin

### F-22 Auth admin & RBAC
Login `/admin/masuk` email + password (argon2id) + TOTP 2FA (wajib untuk role `owner`), rate limit 5/15 menit/IP+email, lockout 15 menit. Sesi admin terpisah (cookie `__Host-tk_admin`, 8 jam, idle 30 menit). Role awal: `owner`, `admin`, `finance`, `editor` dengan permission granular (lihat business-rules BR-40). Semua server action admin memanggil `requirePermission()`. **AC-22.x**

### F-23 Dashboard admin
KPI (total donasi paid, transaksi sukses, pending, total donatur, campaign aktif), grafik donasi harian 30 hari, performa campaign (top 5 terkumpul, konversi), transaksi terbaru. Filter rentang tanggal. **AC-23.x**

### F-24 Manajemen campaign
List (filter status/kategori, cari judul), create/edit (semua field C4), upload gambar utama + galeri ke Vercel Blob (OD-12; urutkan, alt wajib), pengaturan nominal (open: min, max, saran[]; fixed: paket CRUD/aktif/urut), SEO, publish/pause/complete/archive. Hapus permanen hanya untuk `draft` tanpa transaksi; selain itu archive. **AC-24.x**

### F-25 Manajemen berita
List, create/edit dengan rich text (TipTap), gambar utama, relasi campaign, draft/publish (+jadwal publish opsional P2), hapus (soft delete). **AC-25.x**

### F-26 Manajemen metode pembayaran
List per provider, status konfigurasi provider (cek env tersedia & tes koneksi — tanpa menampilkan kredensial), aktif/nonaktif metode, urutan tampil, nama tampil, logo, instruksi (markdown per kanal), batas min/max, biaya (bila dibebankan ke donatur). **AC-26.x**

### F-27 Manajemen transaksi
List dengan filter status, tanggal, campaign, provider; cari kode transaksi / email / nama / no. WA; detail (timeline, payment attempts, payment events, notifikasi); ekspor CSV (sesuai filter, async bila >10.000 baris); tombol "Cek status ke provider" (rekonsiliasi manual). Admin **tidak bisa** mengubah status ke `paid` secara manual. **AC-27.x**

### F-28 Manajemen donatur
List (nama, email, WA, total donasi, jumlah transaksi, terakhir donasi, akun/tamu), cari & filter, detail + riwayat, ekspor CSV (permission `donors.export`). **AC-28.x**

### F-29 Log pembayaran & webhook
List `payment_events` (provider, tipe, status verifikasi, hasil proses, payload ter-redaksi), detail JSON. **AC-29.x**

### F-30 Audit log
Setiap aksi admin yang mengubah data (campaign, news, metode bayar, template, setting, role) tercatat: aktor, aksi, entitas, before/after (diff), IP, user agent, waktu. Read-only. **AC-30.x**

---

## G. Penambahan scope (disetujui 10 Nov 2026)

### F-31 Listing Campaign (OD-07)
- **Deskripsi:** Halaman `/campaign` berisi grid kartu campaign `published` (kartu sama dengan Home), filter kategori (chip), paginasi "Muat lagi". Campaign `completed` tampil di bagian terpisah "Program selesai" di bawah daftar aktif. Tanpa pencarian.
- **Peran:** Publik.
- **Prasyarat:** Ada ≥0 campaign `published`/`completed`.
- **Alur utama:** Buka `/campaign` → (opsional) pilih kategori → klik kartu → Campaign Detail.
- **Alternatif:** Tidak ada campaign → empty state "Program kebaikan segera hadir". Kategori tanpa campaign → empty state per kategori.
- **Validasi:** `?kategori=` harus slug kategori aktif; jika tidak, abaikan dan tampilkan semua. `draft`/`archived`/`paused` tidak pernah tampil di daftar.
- **Error:** Gagal ambil data → error state + "Coba lagi".
- **AC:** AC-31.1–AC-31.4.

### F-32 Halaman Legal (OD-08)
- **Deskripsi:** Halaman statis `/kebijakan-privasi`, `/syarat-ketentuan`, `/tentang`, `/kontak`. Kontak menampilkan email, alamat, dan WhatsApp lembaga dari `platform_settings` (`organization.*`), tanpa formulir. Tautan di footer semua halaman publik, halaman `/masuk`, dan persetujuan di Checkout Form.
- **Peran:** Publik.
- **Prasyarat:** Teks final disediakan legal lembaga (draf placeholder dilarang rilis ke produksi, lihat release-checklist).
- **Alur utama:** Klik tautan footer → baca halaman.
- **Alternatif:** Data `organization.*` kosong → bagian terkait disembunyikan.
- **Validasi:** Satu H1, metadata & canonical unik; boleh diindeks.
- **Error:** 404 standar untuk path lain.
- **AC:** AC-32.1–AC-32.4.

### F-33 Rincian Penyaluran Dana (OD-06)
- **Deskripsi:** Admin mencatat penyaluran per campaign: nominal (rupiah bigint), jenis (`program`/`operational`/`bank_fee`), keterangan, tanggal penyaluran, tautan opsional ke berita campaign sebagai bukti. Publik melihat komponen "Rincian Penyaluran Dana" di Campaign Detail: terkumpul vs tersalurkan, daftar penyaluran (terbaru dulu), tautan berita bukti.
- **Peran:** Admin dengan `disbursements.write` (owner, admin, finance); publik (baca).
- **Prasyarat:** Campaign ada; berita bukti (bila dipilih) milik campaign yang sama dan `published`.
- **Alur utama:** Admin buka editor campaign → tab "Penyaluran Dana" → tambah entri → simpan (audit log) → tampil di halaman publik.
- **Alternatif:** Belum ada penyaluran → komponen publik menampilkan "Belum ada penyaluran dana" atau disembunyikan. Ubah/hapus entri (soft delete) tercatat before/after di audit log.
- **Validasi:** Zod; `amount` integer > 0 (bigint); total penyaluran ≤ `collected_amount` campaign (BR-43); `disbursed_at` tidak di masa depan; `news_id` harus milik campaign yang sama.
- **Error:** Melebihi dana terkumpul → pesan inline; tanpa permission → 403.
- **AC:** AC-33.1–AC-33.6.
