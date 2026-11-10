# User Stories

Format: **US-xx** — Sebagai *peran*, saya ingin *tujuan*, agar *manfaat*. (→ fitur)

## Donatur tamu / publik
- **US-01** Sebagai pengunjung, saya ingin melihat campaign unggulan & terbaru di beranda, agar cepat menemukan program. (F-01)
- **US-02** Sebagai pengunjung, saya ingin memfilter campaign per kategori, agar menemukan program yang saya pedulikan. (F-01)
- **US-03** Sebagai pengunjung, saya ingin melihat cerita, progres, rincian dana, berita, dan donatur terbaru, agar yakin sebelum berdonasi. (F-02)
- **US-04** Sebagai pengunjung, saya ingin membaca berita perkembangan program, agar tahu dana disalurkan. (F-03)
- **US-05** Sebagai donatur, saya ingin memilih nominal preset atau mengetik sendiri (campaign open), agar sesuai kemampuan. (F-04)
- **US-06** Sebagai donatur, saya ingin memilih paket donasi (campaign fixed), agar donasi saya sesuai paket program. (F-04)
- **US-07** Sebagai donatur, saya ingin berdonasi tanpa membuat akun, agar prosesnya cepat. (F-04)
- **US-08** Sebagai donatur, saya ingin menyembunyikan nama saya (Hamba Allah), agar donasi saya anonim di publik. (F-04)
- **US-09** Sebagai donatur, saya ingin memilih metode bayar yang tersedia, agar bisa bayar dengan e-wallet/QRIS/VA. (F-05)
- **US-10** Sebagai donatur, saya ingin melihat nomor VA/QR/link bayar beserta batas waktu dan langkah bayar, agar tidak salah bayar. (F-06)
- **US-11** Sebagai donatur, saya ingin melihat konfirmasi sukses dan mengunduh kuitansi, agar punya bukti. (F-07)
- **US-12** Sebagai donatur, saya ingin halaman pending yang otomatis memperbarui status, agar tahu kapan pembayaran diterima. (F-08)
- **US-13** Sebagai donatur, saya ingin menerima email & WhatsApp (bila setuju) untuk status donasi, agar tidak perlu kembali ke situs. (F-19)

## Donatur login
- **US-14** Sebagai donatur, saya ingin masuk dengan Google, agar tidak perlu mengingat password. (F-09)
- **US-15** Sebagai donatur, saya ingin donasi tamu saya dengan email yang sama muncul di dashboard setelah login, agar riwayat lengkap. (F-11)
- **US-16** Sebagai donatur, saya ingin melihat total donasi, jumlah sukses & pending. (F-12)
- **US-17** Sebagai donatur, saya ingin melihat riwayat dan detail transaksi. (F-13)
- **US-18** Sebagai donatur, saya ingin mengunduh PDF transaksi dan kuitansi donasi. (F-14)
- **US-19** Sebagai donatur, saya ingin mengubah nama tampilan, nomor WhatsApp, dan preferensi notifikasi. (F-15)
- **US-20** Sebagai donatur, saya ingin keluar dari akun. (F-10)

## Admin
- **US-21** Sebagai admin, saya ingin login aman ke panel admin yang terpisah dari akun donatur. (F-22)
- **US-22** Sebagai admin, saya ingin melihat KPI donasi, grafik, dan performa campaign. (F-23)
- **US-23** Sebagai admin, saya ingin membuat/mengedit/mempublikasi/menjeda/mengarsipkan campaign. (F-24)
- **US-24** Sebagai admin, saya ingin mengatur tipe nominal (open: min, max, saran; fixed: paket yang bisa diurutkan & dinonaktifkan). (F-24)
- **US-25** Sebagai admin, saya ingin menulis berita campaign dengan rich text dan gambar, simpan draft atau publikasi. (F-25)
- **US-26** Sebagai admin, saya ingin mengaktifkan metode bayar, mengatur urutan dan instruksinya. (F-26)
- **US-27** Sebagai admin, saya ingin mencari & memfilter transaksi, melihat log pembayaran, dan ekspor CSV. (F-27, F-29)
- **US-28** Sebagai admin, saya ingin melihat daftar donatur dan riwayatnya, serta ekspor. (F-28)
- **US-29** Sebagai admin, saya ingin mengelola template email/WA, preview, dan mengirim tes. (F-20)
- **US-30** Sebagai admin, saya ingin melihat log notifikasi dan status pengiriman. (F-21)
- **US-31** Sebagai pemilik lembaga, saya ingin setiap perubahan penting tercatat di audit log. (F-30)

## Sistem
- **US-32** Sebagai sistem, saya harus memproses webhook secara idempoten agar total campaign tidak bertambah dua kali. (F-17)
- **US-33** Sebagai sistem, saya harus menandai transaksi kedaluwarsa dan merekonsiliasi status pending dengan provider. (F-18)
