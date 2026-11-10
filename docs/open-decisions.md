# Open Decisions — butuh keputusan PM sebelum Phase 2

| # | Keputusan | Opsi | Rekomendasi | Dampak bila tertunda |
|---|---|---|---|---|
| OD-01 | ✅ **Diputuskan 10 Nov 2026:** nama brand tetap **“Tebar Kebaikan”** | — | Cek merek (PDKI) & ketersediaan domain tetap disarankan sebelum M1 (domain final belum diputuskan) | Branding, OAuth consent screen, email pengirim |
| OD-02 | Entitas hukum & izin pengumpulan dana (PUB) | Yayasan existing / baru | Konsultasi legal; dibutuhkan untuk KYB Midtrans | **Jalur kritis** akun merchant produksi |
| OD-03 | ✅ **Diputuskan 10 Nov 2026:** provider pembayaran = **Midtrans (Core API)** saja | — | Interface `PaymentProvider` tetap dipertahankan; adapter Xendit ditunda (tidak dibangun di MVP). Metode yang hanya tersedia di Xendit (OVO, DANA via Xendit) tidak ditampilkan | M4 lebih pendek ±3 hari |
| OD-04 | ✅ **Diputuskan 10 Nov 2026:** biaya gateway **ditanggung lembaga** | — | Donatur membayar tepat nominal donasi; `payment_methods.fee_borne_by` = `platform` (BR-13). Opsi donatur menanggung biaya tidak dibangun | Tampilan total & kuitansi |
| OD-05 | Biaya operasional platform | 0% / ≤5% transparan / per campaign | ≤5% per campaign, ditampilkan di rincian dana | Copy publik & laporan |
| OD-06 | ✅ **Diputuskan 10 Nov 2026:** rincian penyaluran dana (`campaign_disbursements`) **masuk MVP** | — | Proposal: `02-product/proposals/od-06-rincian-penyaluran-dana.md`; FR F-33, T-50/T-51/T-52 | Tabel + 1 layar admin + komponen publik |
| OD-07 | ✅ **Diputuskan 10 Nov 2026:** halaman listing `/campaign` **ya** (listing sederhana; pencarian ditunda) | — | Proposal: `02-product/proposals/od-07-listing-campaign.md`; FR F-31, T-16 | Implementation T-16 |
| OD-08 | ✅ **Diputuskan 10 Nov 2026:** halaman legal (Kebijakan Privasi, S&K, Tentang, Kontak) **ya** | — | Proposal: `02-product/proposals/od-08-halaman-legal.md`; FR F-32, T-49. Teks final dari legal lembaga | Launch |
| OD-09 | Klaim transaksi tamu dengan email berbeda | Tidak didukung / magic link ke email transaksi | MVP: hanya email sama; magic link P1 | Kepuasan donatur |
| OD-10 | ✅ **Diputuskan 10 Nov 2026:** notifikasi `donation.created` **nonaktif** (hanya `payment.pending` aktif) | — | Template `donation.created` tetap di-seed dengan `is_active = false` | Template seed |
| OD-11 | Gmail SMTP vs penyedia email transaksional | Gmail (sesuai prompt) / Resend/SES nanti | Gmail Workspace untuk MVP, pantau limit harian | Skala saat kampanye besar |
| OD-12 | ✅ **Diputuskan 10 Nov 2026:** penyimpanan gambar = **Vercel Blob** | — | Upload server-side dengan validasi magic bytes, maks 2 MB, re-encode WebP | Editor campaign/news |
| OD-13 | ✅ **Diputuskan 10 Nov 2026:** error tracking = **Sentry (free tier)** | — | PII & secret wajib di-scrub sebelum event dikirim (`beforeSend`) | Observabilitas |
| OD-14 | Retensi data keuangan & PII | 5 / 10 tahun | Ikuti arahan akuntan/legal (umumnya 10 tahun dokumen keuangan) | Kebijakan privasi, anonimisasi |
| OD-15 | Rate limit saat Redis down | Fail-open / fail-closed | Fail-open + alert (donasi tidak terblokir) | Ketahanan checkout |
| OD-16 | Mode warna gelap | Tidak / nanti | Light saja di MVP (sesuai prompt) | — |
| OD-17 | Admin di path `/admin` vs subdomain `admin.` | path / subdomain | Path `/admin` + cookie `__Host-` terpisah; subdomain bila tim bertambah | Konfigurasi cookie & CSP |
