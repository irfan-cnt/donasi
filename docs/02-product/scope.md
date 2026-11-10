# Scope — Tebar Kebaikan MVP

Bagian ini mengikuti **Fixed Project Scope (C)** master prompt. Fitur di luar daftar ini wajib diusulkan terpisah.

## In scope

### C1. Halaman publik
| # | Halaman | Route usulan |
|---|---|---|
| 1 | Home | `/` |
| 2 | Campaign Detail | `/campaign/[slug]` |
| 3 | News Detail | `/campaign/[slug]/berita/[newsSlug]` |
| 4 | Checkout Form | `/donasi/[slug]` |
| 5 | Select Payment | `/donasi/[slug]/pembayaran?trx=` |
| 6 | Payment Instruction | `/transaksi/[code]/instruksi` |
| 7 | Payment Success | `/transaksi/[code]/berhasil` |
| 8 | Payment Pending | `/transaksi/[code]/menunggu` |
| 9 | Listing Campaign (OD-07) | `/campaign` |
| 10 | Kebijakan Privasi (OD-08) | `/kebijakan-privasi` |
| 11 | Syarat & Ketentuan (OD-08) | `/syarat-ketentuan` |
| 12 | Tentang (OD-08) | `/tentang` |
| 13 | Kontak (OD-08) | `/kontak` |

Halaman transaksi publik diakses dengan **kode transaksi + token akses** (signed, lihat security.md), bukan ID berurutan.

### C2. Auth donatur
Login Google (Auth.js), profil, logout, dashboard terproteksi, guest donation, klaim transaksi tamu.

### C3. Donor dashboard
Ringkasan (total donasi, sukses, pending), riwayat, detail, PDF transaksi, PDF kuitansi, profil.

### C4. Campaign
Open/Fixed amount, status Draft/Published/Paused/Completed/Archived, field lengkap, target opsional.

### C5. Berita campaign
CRUD, draft/publish, gambar (Vercel Blob, OD-12), rich text, relasi campaign, halaman publik.

### C6. Pembayaran
**Midtrans Core API** (keputusan OD-03; Xendit ditunda) via interface `PaymentProvider`, webhook terverifikasi, idempotensi, log event, rekonsiliasi, instruksi per metode. Biaya gateway ditanggung lembaga (OD-04): donatur membayar tepat nominal donasi.

### C7. Notifikasi
Email (Nodemailer + Gmail SMTP), WhatsApp (Fonnte), template + variabel, preview, test send, log. Event `donation.created` nonaktif (OD-10); hanya `payment.pending` yang aktif.

### C8. Admin panel
Dashboard, campaign, news, metode bayar, transaksi (+export CSV), donor (+export), notifikasi, log pembayaran & webhook, auth admin + RBAC.

### C9. Rincian penyaluran dana (OD-06)
Admin mencatat penyaluran dana per campaign (nominal, jenis, keterangan, tanggal, tautan berita bukti); publik melihat rinciannya di Campaign Detail. Proposal: `proposals/od-06-rincian-penyaluran-dana.md`.

### Penambahan scope yang disetujui (10 Nov 2026)
Listing `/campaign` sederhana tanpa pencarian (OD-07, `proposals/od-07-listing-campaign.md`) dan halaman legal (OD-08, `proposals/od-08-halaman-legal.md`) kini bagian dari C1; rincian penyaluran dana (OD-06) menjadi C9.

## Out of scope (MVP)
Lihat PRD §8. Pencarian campaign tetap di luar scope (ditunda; OD-07). Listing `/campaign` dan halaman legal sudah masuk scope (OD-07, OD-08).

## Asumsi
- Satu lembaga pengelola (single-tenant).
- Mata uang IDR saja; zona waktu `Asia/Jakarta`.
- Bahasa antarmuka: Indonesia.
