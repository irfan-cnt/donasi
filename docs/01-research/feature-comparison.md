# Perbandingan Fitur — Amalsholeh.com vs Tebar Kebaikan (MVP)

Legenda: ✅ ada · ➖ tidak ada · 🔜 di luar scope MVP (usulan terpisah) · [V]/[A] lihat competitor-analysis.md

| Area | Fitur | Amalsholeh | Tebar Kebaikan MVP | Catatan |
|---|---|---|---|---|
| Discovery | Banner/hero carousel | ✅ [V] | ✅ | Kita batasi 3 slide, tanpa pop-up interstisial |
| | Pencarian program & lembaga | ✅ [V] | 🔜 | Scope C1 tidak memuat halaman pencarian; homepage punya filter kategori |
| | Filter kategori | ✅ [V] | ✅ | |
| | Pop-up promosi | ✅ [V] | ➖ | Sengaja dihilangkan (mengganggu, salah klik) |
| Campaign | Detail program | ✅ [V] | ✅ | |
| | Progress & target | Sebagian [V] (banyak "∞") | ✅ | Target opsional, dipisah dari tipe nominal |
| | Rincian penggunaan dana | ✅ [V] | ✅ (ringkas) | Terkumpul, disalurkan, biaya, sisa |
| | Berita/update program | ✅ [V] | ✅ | News Detail Page tersendiri |
| | Daftar donatur terbaru | ✅ [V] | ✅ | Default anonim "Hamba Allah" |
| | Fundraiser/referral | ✅ [V] | 🔜 | |
| | Profil lembaga/mitra | ✅ [V] | ➖ | MVP: platform tunggal, admin membuat campaign |
| Donasi | Pilih nominal (preset + custom) | ✅ [V] | ✅ Open Amount | |
| | Paket nominal tetap | ➖ | ✅ Fixed Amount | |
| | Minimum donasi | ✅ Rp10.000 web [V] | ✅ dikonfigurasi per campaign | |
| | Maksimum donasi | ➖ (bug) [V] | ✅ | |
| | Form data donatur | [A] | ✅ Checkout Form | Nama, email, WA, anonim, doa |
| | Guest donation | [A] | ✅ | |
| Pembayaran | E-wallet, QRIS, VA | ✅ [V] | ✅ via Midtrans | Hanya metode yang didukung provider aktif |
| | Dompet internal | ✅ Saku Kebaikan [V] | ➖ | Menyentuh regulasi uang elektronik |
| | Instruksi pembayaran | [A] | ✅ | |
| | Halaman sukses/pending | [A] | ✅ | |
| Akun | Login email/password | ✅ [V] | ➖ | MVP: Google SSO saja |
| | Login Google | ✅ [V] | ✅ | |
| | Login Facebook | ✅ [V] | ➖ | |
| | Riwayat donasi di web | ➖ (ke app) [V] | ✅ | Diferensiator utama |
| | PDF transaksi & kuitansi | [A] | ✅ | |
| Notifikasi | Email | [A] | ✅ Nodemailer/Gmail | |
| | WhatsApp | [A] | ✅ Fonnte | Dengan consent |
| Produk lain | Zakat, Qurban, Sedekah Rutin | ✅ [V] | 🔜 | |
| Admin | Dashboard, CRUD campaign/news, transaksi, donor, template notifikasi, log | [A] (private) | ✅ | |
