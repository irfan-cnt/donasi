# Aset Gambar Instagram — Tebar Kebaikan

Gambar siap unggah untuk paket konten P31 (`../feed-posts.md`, `../carousel-posts.md`, `../profile.md`). Semua desain berupa tipografi + ilustrasi bentuk sederhana; logo memakai file asli (`assets/brand-src/`), tanpa foto stok dan tanpa gambar AI.

## Render ulang
```bash
node marketing/instagram/assets/src/render.mjs              # semua gambar + contact-sheet.png + src/status.json
node marketing/instagram/assets/src/render.mjs IG-CR-01-S3  # satu/beberapa ID saja
```
- Ubah teks hanya di `src/data.js` (`*kata*` = sorotan, `{{label}}` = slot data → pita "DRAF — PERLU DATA" otomatis, `\n` = baris baru).
- Tata letak: `src/layouts.js` (template), `src/styles.css` (token warna/tipografi), `src/icons.js` (ikon garis).
- Font lokal di `src/fonts/` (Plus Jakarta Sans & Fraunces, lisensi OFL terlampir); render tidak butuh jaringan. Memakai Playwright/Chromium yang sudah ada di repo, dari `file://`.
- Setelah slot diisi (hapus `{{…}}` dan `draft: true` bila ada), render ulang: pita draf hilang otomatis.

## Sistem template
Cover (hijau tua + motif bintang di sudut, headline Fraunces) → slide isi (krem/krem-emas: langkah bernomor + ponsel generik, pelacak alur, alasan bercentang, daftar cara, tanya-jawab) → CTA penutup (hijau tua, logo di chip putih, tombol oranye "Link di bio"). Perabot tetap: label seri + nomor slide di atas, logo kiri bawah, "Geser →" di semua slide kecuali terakhir.

## File dan status

| File | Ukuran | Status | Data yang dibutuhkan |
|---|---|---|---|
| profile/IG-PF-01.png | 1080×1080 | siap unggah | — (sudah dicek aman untuk potongan bulat) |
| feed/IG-FD-01.png | 1080×1350 | siap unggah | — |
| feed/IG-FD-02.png | 1080×1350 | **perlu data** | foto asli berizin program (atau ilustrasi berlabel), kategori, judul program, nominal terkumpul + tanggal data |
| feed/IG-FD-03.png | 1080×1350 | siap unggah | — |
| feed/IG-FD-04.png | 1080×1350 | siap unggah | — |
| feed/IG-FD-05.png | 1080×1350 | siap unggah | catatan: pastikan 8 kategori masing-masing punya ≥1 program terbit; hapus yang kosong di `data.js` |
| carousel/IG-CR-01/S1, S2, S4, S5, S6 | 1080×1350 | siap unggah | — |
| carousel/IG-CR-01/IG-CR-01-S3.png | 1080×1350 | **perlu data** | metode pembayaran aktif di akun Midtrans produksi |
| carousel/IG-CR-02/S1–S6 | 1080×1350 | siap unggah | baris biaya operasional (OD-05) dihapus sesuai instruksi P31 |
| carousel/IG-CR-03/S1–S6 | 1080×1350 | siap unggah | klaim pajak/zakat tidak disebut (default P31) |
| carousel/IG-CR-04/S1–S7 | 1080×1350 | **perlu data** (template) | dari berita yang sudah terbit: judul kabar, kebutuhan program, kegiatan + tanggal + kota/kab., nominal disalurkan + jenis bantuan + tanggal, kutipan berizin (atau hapus S5), status program, foto asli berizin; ikuti checklist izin di `carousel-posts.md` |
| carousel/IG-CR-05/S1–S5 | 1080×1350 | siap unggah | — |
| carousel/IG-CR-05/IG-CR-05-S6.png | 1080×1350 | **perlu data** | domain resmi, username Instagram |
| carousel/IG-CR-05/IG-CR-05-S7.png | 1080×1350 | **perlu data** | kontak resmi (sama dengan /kontak) |

Total 38 gambar: 27 siap unggah, 11 perlu data. Daftar lengkap per ID ada di `src/status.json`. Tinjauan cepat: `contact-sheet.png`.

## Teks P31 yang dipersingkat agar terbaca di HP
- CR-01 S2: "…pilih atau ketik nominal (atau paket, untuk program bernominal tetap)." → "…lalu pilih atau ketik nominal."
- CR-01 S3: kalimat panjang → "Isi nama dan email/WhatsApp. Mau anonim? Tampil sebagai “Hamba Allah”. Metode: [slot]." (ajakan menulis doa dihapus)
- CR-01 S4: "Perhatikan batas waktu pembayaran di layar." → "Perhatikan batas waktunya."
- CR-02 S4: "Ada bukti kabar." → "Ada kabar sebagai bukti."; S5: baris biaya operasional dihapus.
- CR-03 S2: "Bukti donasi yang sah dari lembaga." → "Bukti donasi dari lembaga."
- CR-05 S3: "…atau kembali dari aplikasi…" dihapus; S4: "…atau mengganti metode sebelum batas waktu" dihapus.
- FD-01/03/04: teks pendukung diambil dari caption (poin singkat).
