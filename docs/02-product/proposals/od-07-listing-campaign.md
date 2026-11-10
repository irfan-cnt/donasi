# Proposal OD-07 — Halaman Listing Campaign

Status: ✅ Disetujui PM, 10 Nov 2026 (listing sederhana; pencarian ditunda).

## Latar belakang
Home hanya menampilkan campaign pilihan dan terbaru. Pengunjung dan mesin pencari membutuhkan satu halaman yang memuat semua campaign aktif. Biaya implementasi kecil dan nilai SEO tinggi.

## Keputusan
Tambah halaman `/campaign` berupa **listing sederhana**. **Pencarian ditunda** (tetap di luar scope).

## Cakupan
- Route `/campaign`: grid kartu campaign `published` (kartu sama dengan Home), filter kategori `?kategori=`, paginasi/"Muat lagi".
- Campaign `completed` tampil di bagian terpisah di bawah daftar aktif.
- ISR + cache; metadata & H1 unik; link dari header/footer.

## Di luar cakupan
- Pencarian teks, sortir lanjutan, filter multi-kriteria.
- Halaman kategori terpisah.

## Dampak
- Tidak ada perubahan skema (memakai index `campaigns (status, published_at DESC)`).
- Estimasi T-16: 1d, dependensi T-15.
- Dokumen: scope C1 (#9), F-31, AC-31.x; PRD §8 diperbarui (listing tidak lagi di luar scope).
