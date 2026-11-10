# Kekuatan & Kelemahan — Amalsholeh.com

## Kekuatan

| # | Kekuatan | Bukti | Pelajaran untuk kita |
|---|---|---|---|
| S1 | Mobile-first, pola mirip aplikasi (bottom nav) | [V] beranda & detail | Pertahankan bottom nav untuk publik di mobile |
| S2 | Alur donasi pendek: Detail → Nominal → Metode | [V] | Target ≤ 3 layar sampai instruksi bayar |
| S3 | Transparansi dana: terkumpul, dicairkan, DPD ≤5%, admin bank, sisa | [V] Rincian penggunaan dana | Jadikan komponen standar di Campaign Detail |
| S4 | Update/berita pencairan dana per program | [V] "Pencairan Dana Rp 45.000.000" | News terikat campaign |
| S5 | Social proof: daftar donatur, fundraiser leaderboard, badge mitra terverifikasi | [V] | Tampilkan donatur terbaru + jumlah donatur |
| S6 | Variasi metode bayar lengkap (e-wallet, QRIS, banyak VA) | [V] | Dukung melalui adapter provider |
| S7 | Validasi minimum nominal + filter huruf | [V] | Validasi sama di client **dan** server |
| S8 | Performa awal baik, tanpa error konsol | [V] | Budget performa (lihat performance.md) |
| S9 | Halaman 404 & empty state pencarian rapi | [V] | Siapkan empty/error state di semua halaman |

## Kelemahan

| # | Kelemahan | Bukti | Dampak | Respons desain kita |
|---|---|---|---|---|
| W1 | Tidak ada batas maksimum nominal; angka >16 digit kehilangan presisi (9999999999999999 → 10.000.000.000.000.000) dan tombol bayar tetap aktif | [V] | Risiko data finansial salah, error di gateway | Nominal disimpan sebagai `bigint` rupiah; validasi Zod min/max; input dibatasi panjang |
| W2 | Pop-up promosi muncul beberapa detik setelah load dan menutupi layar | [V] klik tab kategori terbuka ke campaign lain | Salah klik, menurunkan kepercayaan | Tanpa interstisial; promosi via banner statis |
| W3 | Riwayat donasi tidak tersedia di web ("Donasi Saya" → unduh aplikasi) | [V] | Donatur web tidak bisa cek status/kuitansi | Donor Dashboard web lengkap + PDF |
| W4 | Donasi < Rp10.000 hanya via aplikasi | [V] | Friksi | Minimum per campaign dikonfigurasi admin |
| W5 | Waktu relatif salah ("8 jam dari sekarang" untuk donasi yang sudah lalu) | [V] daftar donatur | Mengurangi kredibilitas | Simpan `timestamptz` UTC, render di `Asia/Jakarta` |
| W6 | SEO: H1 beranda kosong, tanpa JSON-LD, tanpa canonical | [V] | Visibilitas organik rendah | Metadata API Next.js, JSON-LD, canonical |
| W7 | Aksesibilitas: gambar tanpa alt | [V] 5/44 | | Alt wajib di form upload admin |
| W8 | Pencarian lambat (skeleton >2 s, hasil ±5 s) | [V] | | (Pencarian di luar scope; cache Redis untuk listing) |
| W9 | Banyak program tanpa target ("∞") dan program "Sudah berakhir" tetap tampil di daftar | [V] | Urgensi & relevansi rendah | Listing default hanya `published`; completed di bagian terpisah |
| W10 | Login masih email/password + Facebook + Google | [V] | Permukaan serangan & beban reset password | Google SSO saja di MVP + guest checkout |
| W11 | Banyak varian kategori & produk (zakat, qurban, saku, seru) membuat IA padat | [V] | Beban kognitif | MVP fokus satu alur donasi |
