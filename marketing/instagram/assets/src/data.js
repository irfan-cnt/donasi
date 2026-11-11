/*
 * Konten semua gambar Instagram Tebar Kebaikan (sumber: marketing/instagram/*.md, paket P31).
 * Ubah teks di sini lalu jalankan:  node marketing/instagram/assets/src/render.mjs
 *
 * Sintaks kecil di dalam teks:
 *   *kata*        -> sorotan (kuning di latar gelap, oranye-teks di latar terang)
 *   {{label}}     -> slot data kosong; gambar otomatis diberi pita "DRAF — PERLU DATA"
 *   \n            -> pindah baris paksa
 * Field `draft: true` memaksa pita draf walau tanpa slot (mis. template IG-CR-04).
 * Field `note` hanya untuk README (catatan data yang perlu dilengkapi), tidak tampil di gambar.
 */
window.IG_DATA = {
  profile: [
    { id: 'IG-PF-01', out: 'profile/IG-PF-01.png', w: 1080, h: 1080, tpl: 'profile' },
  ],

  feed: [
    {
      id: 'IG-FD-01', out: 'feed/IG-FD-01.png', tpl: 'intro',
      kicker: 'Kini hadir',
      title: 'Kebaikan kecil, tersampaikan dengan *jelas.*',
      points: ['Donasi tanpa wajib akun', 'Status dikonfirmasi penyedia pembayaran', 'Kuitansi PDF', 'Rincian penyaluran dana'],
      cta: 'Lihat program lewat link di bio',
    },
    {
      id: 'IG-FD-02', out: 'feed/IG-FD-02.png', tpl: 'program', draft: true,
      kicker: 'Program pilihan',
      category: '{{kategori}}',
      title: '{{judul program}}',
      raised: 'Terkumpul Rp{{nominal}}',
      date: 'per {{tanggal}}',
      cta: 'Donasi sekarang — link di bio',
      note: 'Foto dokumentasi asli program + izin (atau ilustrasi berlabel "Ilustrasi"), kategori, judul program, nominal terkumpul dan tanggal data dari dashboard admin produksi. Template: buat salinan per program.',
    },
    {
      id: 'IG-FD-03', out: 'feed/IG-FD-03.png', tpl: 'anon',
      kicker: 'Boleh tampil sebagai Hamba Allah',
      title: 'Berdonasi tanpa perlu *dikenal.*',
      body: 'Aktifkan pilihan anonim, namamu tampil sebagai “Hamba Allah”. Email dan WhatsApp tidak pernah tampil ke publik.',
      cta: 'Pilih program lewat link di bio',
    },
    {
      id: 'IG-FD-04', out: 'feed/IG-FD-04.png', tpl: 'receipt',
      kicker: 'Untuk setiap donasi',
      title: 'Donasi terkonfirmasi, *kuitansi terbit.*',
      body: 'Kuitansi PDF bernomor dikirim ke email setelah pembayaran dikonfirmasi penyedia pembayaran.',
      cta: 'Coba donasi pertamamu — link di bio',
    },
    {
      id: 'IG-FD-05', out: 'feed/IG-FD-05.png', tpl: 'grid',
      kicker: 'Pilih bidang kebaikanmu',
      title: 'Satu niat, banyak *jalan kebaikan.*',
      items: [
        ['book', 'Pendidikan'], ['pulse', 'Kesehatan'], ['handheart', 'Kemanusiaan'], ['dome', 'Masjid'],
        ['family', 'Yatim & Dhuafa'], ['cloud', 'Bencana Alam'], ['package', 'Palestina'], ['star', 'Lainnya'],
      ],
      cta: 'Lihat semua program — link di bio',
      note: 'Sebelum tayang, pastikan setiap kategori di gambar punya minimal satu program terbit (sesuai catatan P31); hapus item kosong di data.js lalu render ulang.',
    },
  ],

  carousels: [
    {
      id: 'IG-CR-01', series: 'Cara donasi', bg: 'cream',
      slides: [
        { tpl: 'cover', kicker: 'Cara donasi', title: 'Donasi cuma *3 langkah.*', body: 'Tanpa wajib daftar akun.', art: 'phone-cover' },
        { tpl: 'step', num: '1', title: 'Pilih program & nominal.', body: 'Buka program, tekan Donasi, lalu pilih atau ketik nominal.', art: 'phone-amount' },
        { tpl: 'step', num: '2', title: 'Isi data & pilih metode.', body: 'Isi nama dan email/WhatsApp. Mau anonim? Tampil sebagai “Hamba Allah”. Metode: {{metode aktif}}.', art: 'phone-form',
          note: 'Daftar metode pembayaran yang aktif di akun Midtrans produksi (mis. QRIS, e-wallet, virtual account).' },
        { tpl: 'step', num: '3', title: 'Bayar sesuai instruksi.', body: 'Pindai QR, buka aplikasi e-wallet, atau transfer ke virtual account. Perhatikan batas waktunya.', art: 'phone-pay' },
        { tpl: 'step', num: '✓', title: 'Selesai!', body: 'Status berubah setelah pembayaran dikonfirmasi penyedia pembayaran. Kuitansi PDF dikirim ke email.', art: 'phone-done' },
        { tpl: 'cta', title: 'Siap menebar *kebaikan?*', body: 'Simpan post ini & coba sekarang.' },
      ],
    },
    {
      id: 'IG-CR-02', series: 'Transparansi dana', bg: 'cream',
      slides: [
        { tpl: 'cover', kicker: 'Transparansi dana', title: 'Donasimu ke mana? *Kamu bisa cek.*', art: 'flow' },
        { tpl: 'flowstep', flow: 1, icon: 'coins', title: 'Terkumpul tercatat otomatis.', body: 'Jumlah terkumpul bertambah setelah pembayaran terkonfirmasi — bukan saat tombol ditekan.' },
        { tpl: 'flowstep', flow: 2, icon: 'list', title: 'Rincian penyaluran dana.', body: 'Di halaman program, lembaga mencatat setiap penyaluran: nominal, jenis, keterangan, tanggal.' },
        { tpl: 'flowstep', flow: 3, icon: 'news', title: 'Ada kabar sebagai bukti.', body: 'Penyaluran dapat ditautkan ke berita program yang memuat dokumentasinya.' },
        { tpl: 'flowstep', flow: 0, icon: 'wallet', title: 'Soal biaya.', body: 'Biaya metode pembayaran ditanggung lembaga. Kamu membayar tepat sebesar nominal donasi.' },
        { tpl: 'cta', title: 'Cek rincian penyaluran di *halaman program.*', body: 'Lihat contohnya lewat link di bio.' },
      ],
    },
    {
      id: 'IG-CR-03', series: 'Kuitansi', bg: 'gold',
      slides: [
        { tpl: 'cover', kicker: 'Kenapa kuitansi penting?', title: 'Sudah simpan *kuitansi* donasimu?', art: 'receipt' },
        { tpl: 'check', n: 1, title: 'Bukti donasi dari lembaga.', body: 'Kuitansi bernomor terbit hanya untuk donasi yang pembayarannya sudah terkonfirmasi.' },
        { tpl: 'check', n: 2, title: 'Isinya tidak berubah.', body: 'Isi kuitansi dibekukan saat terbit — tetap sama meski data profil diubah belakangan.' },
        { tpl: 'check', n: 3, title: 'Arsip pribadimu.', body: 'Catat sedekahmu untuk evaluasi diri dan perencanaan keuangan keluarga.' },
        { tpl: 'ways', title: 'Cara mendapatkannya.', items: [['mail', 'Dikirim ke email sebagai PDF'], ['download', 'Unduh di halaman transaksi'], ['folder', 'Tersimpan di dashboard donatur (login Google)']] },
        { tpl: 'cta', title: 'Donasi, terima kuitansi, *simpan.*', body: 'Mulai donasi lewat link di bio.' },
      ],
    },
    {
      id: 'IG-CR-04', series: 'Kabar program', bg: 'cream', draft: true,
      note: 'Seluruh carousel adalah TEMPLATE. Isi hanya dari berita program yang sudah terbit di produksi: URL berita, judul kabar, latar belakang, kegiatan + tanggal + kota/kabupaten, nominal disalurkan + jenis bantuan + tanggal (sama persis dengan rincian penyaluran), kutipan berizin (atau hapus slide 5), status program, foto asli berizin. Ikuti checklist izin di carousel-posts.md.',
      slides: [
        { tpl: 'cover', kicker: 'Kabar program', title: '{{judul kabar}}', art: 'photo' },
        { tpl: 'story', label: 'Latar belakang', body: '{{kebutuhan program, 1–2 kalimat}}', photo: true },
        { tpl: 'story', label: 'Yang sudah dilakukan', body: '{{kegiatan, tanggal, kota/kabupaten}}', photo: true },
        { tpl: 'figure', label: 'Dalam angka', value: 'Rp{{nominal}}', body: 'disalurkan untuk {{jenis bantuan}} pada {{tanggal}}', source: 'Sumber: rincian penyaluran di halaman program' },
        { tpl: 'story', label: 'Pesan dari lapangan', body: '“{{kutipan berizin}}”', photo: true },
        { tpl: 'statement', title: 'Terima kasih, para donatur', body: 'termasuk para Hamba Allah. Program {{masih dibuka / sudah selesai}}.' },
        { tpl: 'cta', title: 'Baca kabar lengkapnya di *halaman program.*', body: 'Link di bio.' },
      ],
    },
    {
      id: 'IG-CR-05', series: 'FAQ keamanan', bg: 'cream',
      slides: [
        { tpl: 'cover', kicker: 'FAQ keamanan pembayaran', title: 'Aman nggak sih bayar donasi *online?*', art: 'shield' },
        { tpl: 'faq', q: 'Siapa yang memproses pembayaran?', a: 'Midtrans, penyedia payment gateway. Tebar Kebaikan tidak menyimpan PIN atau kata sandi rekening/e-wallet kamu.', icon: 'lock' },
        { tpl: 'faq', q: 'Kapan donasiku dianggap berhasil?', a: 'Hanya setelah penyedia pembayaran mengonfirmasi. Menutup halaman tidak mengubah status.', icon: 'check' },
        { tpl: 'faq', q: 'Kalau batas waktu pembayaran habis?', a: 'Transaksi kedaluwarsa dan tidak ditagih. Kamu bisa membuat donasi baru.', icon: 'clock' },
        { tpl: 'faq', q: 'Apakah data pribadiku tampil?', a: 'Tidak. Email dan WhatsApp tidak pernah tampil publik. Pilih anonim untuk tampil sebagai “Hamba Allah”.', icon: 'eye' },
        { tpl: 'faq', q: 'Hati-hati penipuan.', a: 'Kami tidak pernah meminta OTP/PIN.\nSitus resmi: {{domain resmi}}\nAkun resmi: {{username}}', icon: 'alert',
          note: 'Domain produksi resmi dan username Instagram terpilih.' },
        { tpl: 'cta', title: 'Masih ada *pertanyaan?*', body: 'Hubungi kami: {{kontak resmi}}', note: 'Kontak resmi lembaga (sama dengan halaman /kontak).' },
      ],
    },
  ],
};
