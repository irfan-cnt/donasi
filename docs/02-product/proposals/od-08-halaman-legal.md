# Proposal OD-08 — Halaman Legal

Status: ✅ Disetujui PM, 10 Nov 2026.

## Latar belakang
Aktivasi merchant Midtrans, OAuth consent screen Google, dan kepatuhan UU PDP umumnya mensyaratkan Kebijakan Privasi, Syarat & Ketentuan, profil lembaga, dan kontak yang dapat diakses publik.

## Keputusan
Tambah halaman **Kebijakan Privasi, Syarat & Ketentuan, Tentang, Kontak**.

## Cakupan
- Route: `/kebijakan-privasi`, `/syarat-ketentuan`, `/tentang`, `/kontak`.
- Konten statis (MDX/TSX) berbahasa Indonesia; teks final disediakan legal lembaga, draf awal berupa placeholder yang jelas.
- Tautan di footer semua halaman publik dan di halaman login; checkout menautkan S&K dan Kebijakan Privasi pada persetujuan.
- Kontak menampilkan email, alamat, dan nomor WhatsApp lembaga dari `platform_settings` (`organization.*`); tanpa formulir (tidak ada penyimpanan data pengunjung).
- Metadata & canonical; boleh diindeks.

## Di luar cakupan
- Formulir kontak dengan pengiriman pesan, FAQ/pusat bantuan, blog.
- Manajemen konten legal dari admin (diubah lewat kode/deploy).
- Banner persetujuan cookie (tidak ada pop-up otomatis, AC-01.3).

## Dampak
- Tidak ada perubahan skema.
- Estimasi T-49: 1d, dependensi T-14. Blocker konten: teks legal dari lembaga (jalur sebelum launch dan pengajuan merchant).
- Dokumen: scope C1 (#10-#13), F-32, AC-32.x.
