# Product Requirements Document — Tebar Kebaikan

| Item | Nilai |
|---|---|
| Versi | 0.1 (Draft untuk review Phase 1) |
| Tanggal | 9 November 2026 |
| Pemilik | PM — Mandiribisa |
| Status | Menunggu persetujuan |

## 1. Latar belakang

Donasi online di Indonesia didominasi platform marketplace (contoh: Amalsholeh.com). Riset kami (docs/01-research) menunjukkan alur donasi yang cepat dan transparansi dana yang baik, tetapi juga celah: riwayat donasi tidak tersedia di web, validasi nominal lemah, pop-up mengganggu, SEO lemah. Tebar Kebaikan adalah platform donasi & crowdfunding Islami yang dikelola satu lembaga (admin), fokus pada kesederhanaan, kepercayaan, dan konversi.

## 2. Visi produk

> "Dari menemukan program sampai instruksi bayar dalam kurang dari 60 detik — dengan bukti donasi yang selalu bisa diakses."

Prinsip: sederhana, mobile-first, cepat, terpercaya, transparan, mudah dikelola, fokus konversi, aman, SEO-friendly, skalabel.

## 3. Tujuan & metrik

| Tujuan | Metrik | Target 3 bulan pasca-rilis |
|---|---|---|
| Konversi | Detail campaign → transaksi dibuat | ≥ 8% |
| Penyelesaian bayar | Transaksi dibuat → paid | ≥ 55% |
| Kecepatan | Median waktu landing → instruksi bayar | ≤ 60 s |
| Kepercayaan | Donatur kembali (≥2 donasi / 90 hari) | ≥ 20% |
| Keandalan | Webhook diproses tanpa selisih rekonsiliasi | 100% |
| Performa | LCP mobile p75 | ≤ 2,5 s |

## 4. Persona

1. **Donatur spontan (Rina, 28)** — datang dari Instagram/WhatsApp, HP, ingin cepat, pakai QRIS/e-wallet, sering tidak mau buat akun.
2. **Donatur rutin (Pak Hasan, 45)** — donasi bulanan, butuh kuitansi untuk catatan zakat/sedekah, login Google.
3. **Admin lembaga (Fajar, 32)** — membuat campaign & berita, memantau transaksi, menjawab pertanyaan donatur.

## 5. Scope

Lihat [scope.md](scope.md). Ringkas: 8 halaman publik, auth Google untuk donatur + guest checkout, donor dashboard + PDF, sistem campaign (Open/Fixed amount), berita campaign, pembayaran Midtrans Core API lewat abstraksi provider (OD-03), notifikasi email (Nodemailer/Gmail) & WhatsApp (Fonnte), admin panel lengkap.

## 6. Ringkasan fitur

| ID | Fitur | Prioritas |
|---|---|---|
| F-01..F-08 | Halaman publik (Home → Pending) | P0 |
| F-09..F-11 | Auth donatur (Google SSO, sesi, klaim transaksi tamu) | P0 |
| F-12..F-15 | Donor dashboard, riwayat, PDF, profil | P0 |
| F-16..F-18 | Pembayaran: abstraksi, webhook, expiry & rekonsiliasi | P0 |
| F-19..F-21 | Notifikasi: pengiriman, template, log | P0/P1 |
| F-22..F-30 | Admin: auth & RBAC, dashboard, campaign, news, metode bayar, transaksi, donor, log, audit | P0/P1 |

Detail per fitur: [functional-requirements.md](functional-requirements.md). Aturan bisnis: [business-rules.md](business-rules.md).

## 7. Keputusan produk kunci

1. **Dua varian nominal saja**: `open` dan `fixed`. Target penggalangan adalah konsep terpisah (boleh kosong).
2. **Guest checkout default**; login Google opsional. Transaksi tamu dapat diklaim otomatis bila email Google terverifikasi sama persis dengan email transaksi.
3. **Status bayar hanya dari webhook terverifikasi** atau rekonsiliasi API provider — tidak pernah dari redirect.
4. **Nominal dalam rupiah integer** (`bigint`), tanpa desimal.
5. **Tanpa dompet internal, tanpa marketplace mitra** di MVP.
6. **Biaya platform/operasional** ditampilkan transparan (aturan persentase = keputusan terbuka).

## 8. Di luar scope (usulan terpisah)

Pencarian (listing `/campaign` sederhana sudah masuk scope, OD-07), zakat & kalkulator, qurban, sedekah rutin/recurring, fundraiser/referral, multi-lembaga (mitra), refund otomatis, login email/password atau Facebook, aplikasi mobile native, multi-bahasa.

## 9. Risiko

| Risiko | Mitigasi |
|---|---|
| Gmail SMTP limit harian (±500 / 2.000 untuk Workspace) | Antrian QStash + monitoring; rencana migrasi ke penyedia transaksional |
| Nomor WhatsApp Fonnte terblokir | Consent eksplisit, rate limit, template non-spam |
| Webhook ganda/terlambat | Idempotensi + rekonsiliasi terjadwal |
| Regulasi PUB (izin pengumpulan uang/barang) | Keputusan terbuka — legal review lembaga |

## 10. Dokumen terkait

scope · user-stories · functional-requirements · non-functional-requirements · acceptance-criteria · business-rules · ../03-technical/TRD.md · ../04-database/ERD.md
