# UX Audit — Amalsholeh.com

Heuristik: Nielsen 10 + checklist konversi donasi. Skor 1 (buruk) – 5 (sangat baik). Semua temuan **[V]** kecuali disebut lain.

## 1. Ringkasan skor

| Area | Skor | Catatan utama |
|---|---|---|
| Beranda | 3 | Konten kaya, tapi padat + pop-up interstisial |
| Detail program | 4 | Transparansi dana sangat baik; cerita program terpotong "Selengkapnya" |
| Pilih nominal | 3 | Preset jelas; tidak ada batas atas, presisi angka rusak |
| Pilih metode bayar | 4 | Dikelompokkan (Instan vs Virtual Account) |
| Akun & riwayat | 2 | Riwayat di web dialihkan ke aplikasi |
| Aksesibilitas | 3 | Alt hilang, H1 kosong, kontras teks abu kecil |
| Performa | 4 | ±1,7 s load |

## 2. Temuan detail

### Beranda
1. Pop-up "Traktir Sekarang" muncul tertunda dan menutupi tab kategori (melanggar *user control & freedom*).
2. Tiga section serupa berturut-turut ("Bareng kamu" ×2, "Program") — hierarki kurang jelas.
3. Kartu menampilkan "∞ Status" untuk program tanpa target — label tidak bermakna bagi donatur.
4. Saldo dompet disamarkan (●●●●●●) meski belum login — membingungkan.

### Detail program
5. ✅ Tombol "Donasi Sekarang" menonjol di atas lipatan.
6. ✅ Rincian penggunaan dana: terkumpul, dicairkan, DPD, admin bank, sisa.
7. Narasi "Tentang Program" terpotong pada 2 baris salam — pengguna harus klik untuk konteks inti.
8. Waktu relatif donatur salah ("8 jam dari sekarang").

### Pilih nominal
9. ✅ Huruf diabaikan, pesan error minimum jelas, tombol nonaktif bila invalid.
10. ❌ Tidak ada batas atas; 14–16 digit menghasilkan nilai berbeda dari yang diketik.
11. Memilih preset langsung pindah ke metode bayar (bagus untuk kecepatan) — **[A]** data donatur diminta di langkah berikutnya.

### Metode pembayaran
12. ✅ Grup "Pembayaran Instan" dan "Virtual Account (verifikasi otomatis)".
13. Metode dompet internal ditampilkan walau belum login ("Diperlukan login ke akunmu") — opsi tak bisa dipakai tetap memakan ruang teratas.

### Akun
14. Login masih mengutamakan form email/HP + password; SSO di bawah ("Atau lebih cepat").
15. Galang dana (`/seru`) langsung redirect ke login tanpa penjelasan.

## 3. Rekomendasi untuk Tebar Kebaikan

| Prioritas | Rekomendasi |
|---|---|
| P0 | Validasi nominal min/max di client & server; simpan rupiah sebagai integer |
| P0 | Riwayat & kuitansi donasi tersedia di web |
| P0 | Tidak ada modal/pop-up yang muncul otomatis |
| P1 | Sticky CTA "Donasi Sekarang" di mobile pada Campaign Detail |
| P1 | Ringkasan cerita 3–4 kalimat di atas lipatan sebelum "Baca selengkapnya" |
| P1 | Hanya tampilkan metode bayar yang bisa dipakai saat itu |
| P1 | Waktu ditampilkan `Asia/Jakarta`, relatif + absolut (tooltip) |
| P2 | H1 unik per halaman, JSON-LD `DonateAction`/`NewsArticle`, canonical |
