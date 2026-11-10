# Acceptance Criteria

Format Given/When/Then dipadatkan. ID mengikuti fitur (AC-04.3 = fitur F-04 kriteria ke-3).

## F-01 Home
- **AC-01.1** Hanya campaign `published` yang tampil di daftar dan hero.
- **AC-01.2** Memilih kategori memperbarui daftar dan URL `?kategori=` tanpa full reload.
- **AC-01.3** Tidak ada modal/pop-up yang muncul otomatis.
- **AC-01.4** Kartu campaign menampilkan judul, gambar dengan alt, terkumpul, progress (bila ada target), sisa hari/“Berlangsung”.
- **AC-01.5** Halaman memiliki satu H1 bermakna dan metadata unik.

## F-02 Campaign Detail
- **AC-02.1** Campaign draft/archived → 404.
- **AC-02.2** Paused/completed → CTA nonaktif dengan label alasan.
- **AC-02.3** Di mobile, CTA "Donasi Sekarang" sticky di bawah layar.
- **AC-02.4** Donatur anonim tampil "Hamba Allah"; email/WA tidak pernah ada di HTML.
- **AC-02.5** Waktu donatur relatif dan benar terhadap `Asia/Jakarta` (tidak ada “dari sekarang” untuk waktu lampau).
- **AC-02.6** Ada JSON-LD dan `link rel=canonical`.

## F-03 News Detail
- **AC-03.1** News draft → 404 untuk publik.
- **AC-03.2** Menampilkan kartu campaign terkait dengan CTA donasi.
- **AC-03.3** Slug news dengan campaign salah → 404.

## F-04 Checkout Form
- **AC-04.1** Open: nominal < min atau > max menampilkan pesan inline dan tombol nonaktif.
- **AC-04.2** Input hanya menerima digit, maksimal 13 digit, format ribuan otomatis, tanpa kehilangan presisi.
- **AC-04.3** Fixed: hanya paket aktif tampil sesuai urutan; tidak ada input custom.
- **AC-04.4** Mengirim `optionId` paket nonaktif/milik campaign lain via request manual → ditolak server (400).
- **AC-04.5** Mengirim `amount` hasil manipulasi untuk fixed campaign → server memakai nominal paket dari DB.
- **AC-04.6** Email wajib; nama wajib kecuali anonim aktif.
- **AC-04.7** Donatur login → nama, email, WA terisi otomatis.
- **AC-04.8** Rate limit terlampaui → HTTP 429 dan pesan ramah.
- **AC-04.9** Submit sukses membuat transaksi `created` dan redirect ke Select Payment dalam ≤ 1 s (p95).

## F-05 Select Payment
- **AC-05.1** Hanya metode aktif dari provider terkonfigurasi yang tampil.
- **AC-05.2** Metode yang tidak mendukung nominal disembunyikan/nonaktif dengan alasan.
- **AC-05.3** Klik ganda "Bayar Sekarang" tidak membuat dua payment (idempotency).
- **AC-05.4** Sukses → transaksi `pending`, payment tersimpan dengan `provider_ref` dan `expires_at`.
- **AC-05.5** Error provider → pesan, log `payment_events` tipe `create_error`, donatur bisa memilih ulang.
- **AC-05.6** Secret key tidak pernah muncul di response/JS bundle.

## F-06 Payment Instruction
- **AC-06.1** VA: nama bank, nomor VA, tombol salin, countdown.
- **AC-06.2** QRIS: gambar QR, nominal, tombol unduh QR, countdown.
- **AC-06.3** E-wallet: tombol buka aplikasi/URL bayar.
- **AC-06.4** Status `paid` dari server → auto-redirect ke Success dalam ≤ 10 s setelah webhook.
- **AC-06.5** Status `expired` → state kedaluwarsa + "Buat pembayaran baru".
- **AC-06.6** Mengakses tanpa token akses valid → 404.

## F-07 Success
- **AC-07.1** Membuka URL success dengan query `status=paid` saat transaksi belum paid → redirect ke Pending.
- **AC-07.2** Tombol unduh kuitansi menghasilkan PDF dengan nomor kuitansi.
- **AC-07.3** Tamu melihat ajakan login Google untuk menyimpan riwayat.
- **AC-07.4** Event analytics `donation_paid_view` tercatat sekali.

## F-08 Pending
- **AC-08.1** Auto-poll status tiap 5 s maksimal 10 menit.
- **AC-08.2** Redirect sesuai status akhir.
- **AC-08.3** Tombol "Lihat instruksi" kembali ke Instruction.

## F-09–F-11 Auth
- **AC-09.1** Login Google membuat user + donor bila baru.
- **AC-09.2** Email tidak terverifikasi ditolak.
- **AC-09.3** `callbackUrl` eksternal diabaikan (open redirect dicegah).
- **AC-09.4** Cookie sesi `HttpOnly; Secure; SameSite=Lax`.
- **AC-10.1** Akses `/akun` tanpa sesi → redirect `/masuk?callbackUrl=/akun`.
- **AC-10.2** Logout menghapus sesi di DB; cookie lama tidak bisa dipakai.
- **AC-10.3** Sesi donor tidak memberi akses ke `/admin/**`.
- **AC-11.1** Transaksi tamu email sama → muncul di dashboard setelah login pertama.
- **AC-11.2** Email berbeda → tidak terklaim.
- **AC-11.3** Klaim dicatat di audit log.

## F-12–F-15 Donor Dashboard
- **AC-12.1** Total donasi = jumlah transaksi `paid` milik donor.
- **AC-13.1** Mengubah ID/kode transaksi di URL ke milik orang lain → 404.
- **AC-13.2** Filter status & tahun berfungsi; paginasi 20.
- **AC-14.1** PDF kuitansi untuk transaksi non-paid → 404.
- **AC-14.2** PDF milik donor lain → 404.
- **AC-14.3** Response PDF `Cache-Control: private, no-store`.
- **AC-15.1** Nomor WA divalidasi & dinormalisasi `+62`.
- **AC-15.2** Opt-out WA dihormati pada notifikasi berikutnya.

## F-16–F-18 Pembayaran
- **AC-16.1** Mengganti provider aktif tidak mengubah kode checkout (hanya konfigurasi).
- **AC-17.1** Webhook dengan signature salah → 401, status tidak berubah, event tercatat `rejected`.
- **AC-17.2** Webhook `paid` dikirim 5× → total campaign bertambah tepat sekali, notifikasi sukses terkirim sekali.
- **AC-17.3** Webhook `expired` setelah `paid` → diabaikan, dicatat anomali.
- **AC-17.4** Nominal webhook ≠ nominal transaksi → tidak ditandai paid, dicatat `amount_mismatch`, alert admin.
- **AC-18.1** Payment pending lewat expiry → expired setelah dicek ke provider.
- **AC-18.2** Rekonsiliasi menemukan paid di provider tapi pending di DB → diproses jadi paid + dicatat.

## F-19–F-21 Notifikasi
- **AC-19.1** Gagal SMTP → log `failed`, retry ≤3×, status pembayaran tidak berubah.
- **AC-19.2** WA tidak dikirim tanpa opt-in.
- **AC-20.1** Variabel tidak dikenal (mis. `{{donor_ktp}}`) → simpan ditolak.
- **AC-20.2** Preview merender variabel contoh.
- **AC-20.3** Test send hanya ke email/nomor admin yang login.
- **AC-21.1** Log tidak menyimpan secret/token provider; nomor & email dimasking di list.

## F-22–F-30 Admin
- **AC-22.1** 5 login gagal → lockout 15 menit.
- **AC-22.2** Role `editor` mengakses transaksi → 403 di server action & halaman.
- **AC-23.1** KPI sesuai query agregat DB (diuji dengan seed).
- **AC-24.1** Campaign dengan transaksi tidak bisa dihapus permanen, hanya arsip.
- **AC-24.2** Mengubah tipe nominal open→fixed saat ada transaksi pending → peringatan, transaksi lama tidak terpengaruh.
- **AC-24.3** Gambar tanpa alt tidak bisa disimpan.
- **AC-25.1** News publish mengisi `published_at`.
- **AC-26.1** Kredensial provider tidak pernah dikirim ke browser; UI hanya status “Terkonfigurasi / Belum”.
- **AC-27.1** Tidak ada aksi “tandai lunas”.
- **AC-27.2** Ekspor CSV mengikuti filter aktif dan tercatat di audit log.
- **AC-28.1** Ekspor donor membutuhkan `donors.export`.
- **AC-30.1** Setiap update campaign mencatat diff before/after.

## F-31 Listing Campaign
- **AC-31.1** `/campaign` hanya menampilkan campaign `published` (aktif) dan `completed` (bagian terpisah); `draft`/`archived`/`paused` tidak tampil.
- **AC-31.2** Memilih kategori memperbarui daftar dan URL `?kategori=`; slug tidak valid diabaikan.
- **AC-31.3** Empty state tampil bila tidak ada campaign; tidak ada kolom pencarian.
- **AC-31.4** Satu H1 bermakna, metadata unik, dan `link rel=canonical`.

## F-32 Halaman Legal
- **AC-32.1** `/kebijakan-privasi`, `/syarat-ketentuan`, `/tentang`, `/kontak` dapat diakses publik tanpa login (200).
- **AC-32.2** Footer semua halaman publik dan `/masuk` memuat tautan ke keempat halaman.
- **AC-32.3** Checkout Form menautkan S&K dan Kebijakan Privasi pada teks persetujuan.
- **AC-32.4** Kontak menampilkan data dari `platform_settings` (`organization.*`) dan tidak memuat secret.

## F-33 Rincian Penyaluran Dana
- **AC-33.1** Menambah penyaluran tanpa permission `disbursements.write` (mis. role `editor`) → 403 di server action dan halaman.
- **AC-33.2** Nominal ≤ 0, bukan integer, atau total penyaluran melebihi `collected_amount` → ditolak server (400) dengan pesan inline.
- **AC-33.3** `news_id` milik campaign lain atau berita draft → ditolak.
- **AC-33.4** Entri tersimpan tampil di Campaign Detail (terbaru dulu) dengan nominal berformat `id-ID` dan tautan berita bukti bila ada.
- **AC-33.5** Tambah/ubah/hapus tercatat di audit log dengan before/after.
- **AC-33.6** Campaign tanpa penyaluran tidak menampilkan error; halaman publik tetap tampil.
