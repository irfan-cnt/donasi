# Analisis Kompetitor — Amalsholeh.com

> Nama kerja produk kita: **Tebar Kebaikan** (sementara, lihat Open Decisions).
> Tanggal riset: 9 November 2026. Metode: inspeksi manual via browser (Claude in Chrome) pada halaman publik, tanpa login, tanpa membuat transaksi.

## 1. Konvensi penandaan

| Tanda | Arti |
|---|---|
| **[V]** | Terverifikasi — dilihat langsung di halaman publik |
| **[A]** | Asumsi — disimpulkan, belum bisa diverifikasi (butuh login / transaksi / akses mitra) |

## 2. Profil singkat

- **[V]** Operator: Yayasan Bersama Beramal Sholeh (footer "© 2026 Yayasan Bersama Beramal Sholeh"). Tagline `#JembatanKebaikan`.
- **[V]** Model marketplace: lembaga/komunitas/influencer ("Mitra") membuat program; platform menampung donasi. Ada >11.800 program ("Lihat +11816 program lainnya").
- **[V]** Portal mitra terpisah: `mitra.amalsholeh.com` — alur: Login/Daftar → Isi Form Pengajuan → Menunggu Verifikasi → Mulai Membuat Program.
- **[V]** Aplikasi mobile (Android & iOS) didorong kuat; beberapa fitur web dialihkan ke aplikasi.

## 3. Model bisnis

| Aspek | Temuan |
|---|---|
| Sumber pendapatan | **[V]** "Dana Pengembangan Dakwah (DPD)" maksimal 5% dari donasi terkumpul, ditampilkan di Rincian Penggunaan Dana. |
| Biaya transaksi | **[V]** "Admin bank" ditampilkan terpisah di rincian dana. |
| Supply side | **[V]** Mitra terverifikasi (badge "Akun Terverifikasi"), halaman profil lembaga `/lembaga/{id}` dengan jumlah program, donatur, fundraiser. |
| Growth | **[V]** Fundraiser (ajak orang lain, link `?ref=`), leaderboard fundraiser per program, tombol Bagikan. |
| Retensi | **[V]** Sedekah Rutin, Tabungan Qurban, dompet "Saku Kebaikan". **[A]** Notifikasi push via aplikasi. |
| Produk vertikal | **[V]** Zakat (kalkulator, konsultasi, program zakat mitra yang bekerja sama dengan BAZNAS), Qurban (`qurban.amalsholeh.com`). |

## 4. Arsitektur informasi (terverifikasi)

```
Beranda (/)
├── Pencarian (/search) — tab Program & Lembaga, chip kata populer
├── Program (/programs, ?sort=news) — filter kategori
├── Detail Program (/{slug})
│   ├── Rincian penggunaan dana (accordion)
│   ├── Informasi Mitra → /lembaga/{id}
│   ├── Tentang Program (Selengkapnya)
│   ├── Fundraiser (leaderboard)
│   ├── Berita Terbaru (Lihat Semua Berita)
│   ├── Donatur (daftar donasi terbaru)
│   └── Donasi Sekarang → Pilih Nominal → Pilih Metode Pembayaran → (instruksi [A])
├── Zakat (/zakat) — kalkulator, amil zakat, program zakat
├── Galang Dana (/seru) — wajib login
├── Donasi Saya (/donations-app) — dialihkan ke aplikasi
├── Inbox (/inbox), Akun (/user) — wajib login [A]
├── Login (/login) — email/HP + password, Facebook, Google
└── Mitra (mitra.amalsholeh.com)
```

## 5. Teknis yang teramati

- **[V]** Respons awal (TTFB) ±0,4 s, load selesai ±1,7 s, ±1 MB / 95 resource di beranda.
- **[V]** Tidak ada error konsol JavaScript.
- **[V]** Tidak ada JSON-LD (structured data) dan tidak ada `link rel=canonical` di halaman detail program.
- **[V]** H1 beranda kosong; 5 dari 44 gambar tanpa `alt`.
- **[V]** Gambar disajikan via image proxy/CDN (resize on the fly).

## 6. Batasan riset

Tidak diakses: dashboard donatur (butuh login), dashboard mitra/admin, halaman instruksi pembayaran & status pembayaran (butuh transaksi nyata), email/WhatsApp notifikasi. Semua klaim tentang area tersebut di dokumen lain ditandai **[A]**.
