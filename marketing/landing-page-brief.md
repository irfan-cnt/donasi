# Landing Page Brief — Tebar Kebaikan (P29)

> **Status:** draf untuk Gate PM P29 (setujui headline, klaim kepercayaan, FAQ).
> **Konteks penting:** P27–P28 (akun Midtrans produksi & peluncuran) ditunda PM. Produk **belum live** dan DB produksi kosong. Brief ini **hanya** memakai fakta dari kode & dokumen repo. Semua angka, nama program, nominal terkumpul, jumlah donatur/penyaluran, legalitas, alamat, kontak, dan tanggal yang bukan fakta produk ditulis `[ISI DATA: …]` dan **wajib diisi PM sebelum tayang**. Data seed/dev **tidak boleh** dipakai sebagai contoh nyata.
> **Konsistensi:** kosakata & nada mengikuti `marketing/instagram/brand-guidelines.md` (pakai "program", bukan "campaign"; "donatur", "kuitansi", "Hamba Allah", "rincian penyaluran dana").
> **Pasangan dokumen:** `marketing/landing-page-implementation-brief.md` (input P30).

---

## 1. Positioning

**Untuk** muslim Indonesia yang ingin berdonasi/bersedekah online dengan cepat dan tenang, **Tebar Kebaikan adalah** platform donasi program kebaikan (pendidikan, masjid, yatim & dhuafa, kemanusiaan — mengikuti kategori yang aktif di admin) **yang** membuat berdonasi cukup beberapa langkah tanpa wajib membuat akun, dengan status pembayaran yang dikonfirmasi penyedia pembayaran, kuitansi PDF otomatis, dan rincian penggunaan dana di setiap halaman program.

Pernyataan satu kalimat: *Donasi yang mudah, tercatat, dan bisa kamu pantau.*

## 2. Target audiens

Tidak ada riset pasar di repo; segmen di bawah adalah hipotesis kerja dari PRD, bukan data. Angka ukuran segmen: `[ISI DATA: riset audiens bila ada]`.

| Segmen | Kebutuhan | Keberatan utama | Jawaban dari produk |
|---|---|---|---|
| **Donatur spontan (mobile)** — melihat program dari tautan WhatsApp/Instagram | Cepat, tanpa daftar, bayar pakai metode yang biasa dipakai | "Ribet, harus bikin akun", "Takut salah transfer" | Donasi sebagai tamu; pembayaran via Midtrans dengan instruksi per metode; status dikonfirmasi otomatis |
| **Donatur rutin yang teliti** | Bukti donasi, riwayat, kepastian dana sampai | "Uangnya dipakai untuk apa?" | Kuitansi PDF bernomor; rincian penggunaan dana & kabar penyaluran per program; riwayat di akun (masuk dengan Google, opsional) |
| **Donatur yang ingin tidak dikenal** | Privasi, ikhlas tanpa disebut | "Nama saya muncul di publik" | Pilihan tampil sebagai **Hamba Allah**; email/WA tidak pernah tampil publik |
| **Keluarga/komunitas yang menyebarkan program** | Tautan yang mudah dibagikan | "Apakah programnya jelas?" | Halaman program dengan target, progres, cerita, kabar terbaru, tombol bagikan |

## 3. Value proposition

- **Mudah:** pilih program → isi nominal → bayar. Tanpa wajib akun.
- **Tercatat:** status pembayaran dikonfirmasi oleh penyedia pembayaran, bukan dari klik "saya sudah bayar"; kuitansi PDF terbit otomatis setelah pembayaran terkonfirmasi.
- **Terbuka:** setiap halaman program menampilkan dana terkumpul, rincian penggunaan dana (disalurkan ke program, biaya operasional, biaya transaksi), dan kabar penyaluran.
- **Nominal utuh:** biaya metode pembayaran ditanggung lembaga (OD-04) — kamu membayar tepat sebesar donasi.

## 4. USP (hanya yang bisa dibuktikan di produk)

1. **Donasi tanpa wajib daftar** — checkout tamu; masuk dengan Google hanya opsional untuk riwayat.
2. **Kuitansi PDF otomatis** dengan nomor urut, terbit hanya untuk pembayaran terkonfirmasi (BR-27).
3. **Rincian penggunaan dana di setiap program**, bukan hanya angka terkumpul.
4. **Nominal donasi utuh**: biaya gateway ditanggung lembaga (OD-04). *Catatan: biaya operasional platform (OD-05) belum diputuskan — jangan klaim "100% tersalurkan".*

## 5. Kepribadian brand

Hangat, tenang, jujur, Islami secara halus (sama dengan brand guidelines Instagram). Menyapa dengan "kamu". Meyakinkan lewat fakta (kuitansi, rincian), bukan desakan. Menghormati penerima manfaat; tidak menjual rasa iba. Salam/doa secukupnya ("Alhamdulillah", "Jazakumullahu khairan"). **Tanpa kutipan ayat/hadis** di landing page.

## 6. Hierarki pesan

1. **Utama:** Berdonasi itu mudah dan tercatat.
2. **Pendukung 1 — kemudahan:** tanpa wajib akun; metode pembayaran populer `[ISI DATA: metode yang aktif di akun Midtrans produksi]`.
3. **Pendukung 2 — kepastian:** status dikonfirmasi penyedia pembayaran; kuitansi otomatis.
4. **Pendukung 3 — transparansi:** rincian penggunaan dana & kabar penyaluran di setiap program.
5. **Penutup:** ajakan memilih program.

## 7. Hero — 3 alternatif

| # | Headline | Subheadline | Alasan | Klaim yang diandalkan |
|---|---|---|---|---|
| **A (rekomendasi)** | **Kebaikan kecil, dampak yang nyata.** | Donasi dalam beberapa langkah, tanpa wajib daftar. Kuitansi terbit otomatis dan rincian penggunaan dana bisa kamu lihat di setiap program. | Melanjutkan headline home saat ini (konsisten, sudah diuji e2e & Lighthouse); emosional tapi tidak berlebihan; subheadline memuat dua bukti konkret. | Checkout tamu (ada); kuitansi PDF setelah paid (BR-27); `FundUsage` di halaman program (ada). |
| B | **Berdonasi mudah, tercatat dari awal sampai akhir.** | Pilih program, bayar dengan metode yang kamu biasa pakai, dan terima kuitansi begitu pembayaran terkonfirmasi. | Paling rasional; cocok untuk segmen teliti; menjawab keberatan "uangnya ke mana". | Status dari webhook/cek provider (BR-18); kuitansi (BR-27). "Metode yang biasa dipakai" bergantung `[ISI DATA: metode aktif]`. |
| C | **Sedekah hari ini, pantau penyalurannya nanti.** | Setiap program menampilkan dana terkumpul, rincian penggunaan dana, dan kabar penyaluran — terbuka untuk siapa saja. | Menonjolkan transparansi sebagai pembeda; kata "sedekah" dekat dengan audiens. | Rincian & kabar per program (ada). **Risiko:** saat launch belum ada penyaluran tercatat; janji "pantau" harus dipenuhi admin secara rutin. |

Catatan (diamandemen 11 Nov 2026): **PM memutuskan mempertahankan** "Donasi dalam hitungan detik", "Semua program diverifikasi tim kami sebelum tayang", dan footer "payment gateway berizin Bank Indonesia" — dijamin PM; catatan asli berikut tidak berlaku lagi. Catatan asli: copy home saat ini memakai "Donasi dalam hitungan detik" dan langkah "Semua program diverifikasi tim kami sebelum tayang". Klaim "hitungan detik" tidak terukur dan "diverifikasi" belum didukung prosedur tertulis di repo → di landing diganti "beberapa langkah"; klaim verifikasi hanya dipakai bila PM mengonfirmasi prosedurnya `[ISI DATA: prosedur verifikasi program]`.

## 8. CTA

- **Primer:** "Donasi Sekarang" → program pilihan (`/campaign/{slug}` dari program unggulan) atau `/campaign` bila tidak ada program.
- **Sekunder:** "Lihat Semua Program" → `/campaign`.
- **CTA penutup (setelah FAQ):** "Pilih Program Kebaikan" → `/campaign`.
- Mikrocopy di bawah CTA primer: "Tanpa wajib daftar · Kuitansi otomatis".

## 9. Elemen kepercayaan (hanya yang bisa dibuktikan)

| Elemen | Status | Copy yang boleh |
|---|---|---|
| Legalitas lembaga | **Belum diputuskan (OD-02)** | `[ISI DATA: nama badan hukum, nomor SK Kemenkumham, nomor izin PUB/pengumpulan dana]`. **Section ini tidak tayang sampai OD-02 diputuskan dan dokumen tersedia.** Jangan menulis "terdaftar resmi" tanpa nomor. |
| Pembayaran via Midtrans | Ada (OD-03) | "Pembayaran diproses oleh Midtrans. Status pembayaran dikonfirmasi langsung oleh penyedia pembayaran." Tanpa logo Midtrans/bank kecuali ada izin pemakaian merek `[ISI DATA: izin logo]`. Footer saat ini menyebut "payment gateway berizin Bank Indonesia" — dipertahankan (keputusan PM 11 Nov 2026). |
| Rincian & laporan penyaluran | Ada | "Rincian penggunaan dana dan kabar penyaluran tampil di halaman setiap program." Jangan sebut "laporan keuangan teraudit". |
| Kuitansi otomatis | Ada | "Kuitansi PDF bernomor terbit otomatis setelah pembayaran terkonfirmasi, dikirim ke email dan bisa diunduh." |
| Tidak meminta PIN/OTP | Kebijakan | "Kami tidak pernah meminta PIN, OTP, atau password kamu." |
| Statistik platform | Ada (dinamis) | Terkumpul / jumlah donasi / jumlah laporan dari DB — lihat aturan nol di implementation brief. Jangan menulis angka tetap. |

**Dilarang:** testimoni, logo mitra, sertifikasi, penghargaan, liputan media, jumlah donatur tetap — kecuali tersedia bukti `[ISI DATA]`.

## 10. How It Works (sesuai alur nyata)

1. **Pilih program** — lihat cerita, target, dan progres dana.
2. **Isi nominal & data** — pilih nominal yang disarankan atau isi sendiri (minimal mengikuti program, default Rp10.000); isi nama, email, dan WhatsApp (opsional). Bisa sebagai tamu atau masuk dengan Google. Centang "Hamba Allah" bila tidak ingin namamu tampil. Boleh menitipkan doa.
3. **Bayar** — pilih metode `[ISI DATA: metode aktif, mis. QRIS / e-wallet / virtual account]` dan ikuti instruksinya.
4. **Status terkonfirmasi** — halaman transaksi diperbarui begitu penyedia pembayaran mengonfirmasi.
5. **Terima kuitansi** — kuitansi PDF dikirim ke email dan bisa diunduh dari halaman transaksi (7 hari) atau dari akun kapan saja.

## 11. Showcase program

- **Program pilihan** (1): judul, gambar, kategori, progres terkumpul/target — dari program unggulan di DB.
- **Butuh bantuan segera** (maks. 3): program dengan tenggat terdekat.
- Tiap kartu: gambar, kategori, judul, progres, terkumpul, jumlah donatur, sisa hari.
- Tanpa contoh nama program di copy statis. Bila belum ada program: tampilkan pesan kosong (lihat implementation brief), bukan program contoh.

## 12. Manfaat platform

- **Tanpa wajib akun** — donasi sebagai tamu; akun hanya untuk riwayat.
- **Riwayat & kuitansi di satu tempat** — masuk dengan Google untuk melihat semua donasi dan mengunduh kuitansi; donasi tamu dengan email Google yang sama bisa diklaim ke akun.
- **Privasi** — pilih Hamba Allah; email & WhatsApp tidak pernah tampil publik.
- **Notifikasi** — kabar status lewat email; WhatsApp hanya bila kamu mencentang persetujuan di transaksi itu (OD-19/OD-31).
- **Nominal utuh** — biaya metode pembayaran ditanggung lembaga.

## 13. Bagian transparansi

Judul: **"Ke mana donasimu pergi, bisa kamu lihat."**
Isi: Di setiap halaman program ada **Rincian penggunaan dana**: dana terkumpul, disalurkan ke program, biaya operasional, biaya transaksi bank/gateway, dan dana tersedia. Setiap penyaluran dilengkapi **kabar terbaru** beserta buktinya. Biaya operasional: `[ISI DATA: kebijakan biaya operasional — OD-05 belum diputuskan; usulan ≤5% per program, ditampilkan di rincian dana]`.
Visual: tangkapan layar komponen rincian dana dengan **data ilustrasi yang diberi label "Contoh tampilan"** atau tautan ke program nyata setelah ada penyaluran.

## 14. FAQ (10)

> Teks di bawah adalah **teks final yang tampil** dan harus identik dengan JSON-LD FAQPage.

1. **Apakah saya harus membuat akun untuk berdonasi?**
   Tidak. Kamu bisa berdonasi sebagai tamu cukup dengan nama dan email. Masuk dengan Google bersifat opsional, berguna untuk melihat riwayat donasi dan mengunduh kuitansi kapan saja.
2. **Apakah ada biaya tambahan saat berdonasi?**
   Tidak ada biaya tambahan untuk donatur. Biaya metode pembayaran ditanggung lembaga, sehingga kamu membayar tepat sebesar nominal donasi. Kebijakan biaya operasional program: [ISI DATA: kebijakan OD-05].
3. **Metode pembayaran apa saja yang tersedia?**
   [ISI DATA: daftar metode yang aktif di akun Midtrans produksi]. Pilihan metode tampil di langkah pembayaran.
4. **Apakah pembayaran saya aman?**
   Pembayaran diproses oleh Midtrans. Status donasi hanya berubah setelah dikonfirmasi oleh penyedia pembayaran. Kami tidak pernah meminta PIN, OTP, atau password kamu.
5. **Kapan saya menerima kuitansi?**
   Kuitansi PDF bernomor terbit otomatis setelah pembayaran terkonfirmasi. Kuitansi dikirim ke email dan bisa diunduh dari halaman transaksi selama 7 hari, atau dari akun kapan saja bila kamu masuk dengan Google memakai email yang sama.
6. **Bisakah saya berdonasi tanpa menampilkan nama?**
   Bisa. Centang pilihan Hamba Allah saat mengisi data. Nama kamu tidak tampil di publik; email dan nomor WhatsApp tidak pernah ditampilkan.
7. **Bagaimana saya tahu donasi saya disalurkan?**
   Setiap halaman program menampilkan dana terkumpul, rincian penggunaan dana, dan kabar penyaluran beserta buktinya.
8. **Berapa nominal minimal donasi?**
   Nominal minimal mengikuti setiap program dan tertera di formulir donasi.
9. **Bagaimana jika saya belum menyelesaikan pembayaran?**
   Setiap metode memiliki batas waktu pembayaran yang tertera di halaman instruksi. Bila lewat, transaksi kedaluwarsa dan kamu bisa berdonasi lagi kapan saja.
10. **Apakah saya akan menerima pesan WhatsApp?**
    Hanya bila kamu mencentang persetujuan WhatsApp pada donasi tersebut. Tanpa centang, kabar dikirim lewat email saja.

Tidak dimasukkan (bukan klaim pemasaran): refund (manual, BR-21), legalitas (OD-02 — tambahkan FAQ "Siapa pengelola Tebar Kebaikan?" setelah diputuskan: `[ISI DATA]`), zakat/qurban/donasi rutin (di luar scope).

## 15. Footer

- Logo + tagline: "Platform donasi yang amanah dan transparan. Setiap rupiah tercatat, setiap penyaluran dilaporkan." (copy footer saat ini).
- Pengelola: `[ISI DATA: nama badan hukum & nomor legalitas — OD-02]`.
- Alamat: `[ISI DATA: alamat]` · Kontak: `[ISI DATA: email & WhatsApp resmi]` · Instagram: `[ISI DATA: handle]`.
- Tautan: Beranda, Semua Program, Akun Donatur (ada); Tentang, Kebijakan Privasi, Syarat & Ketentuan, Kontak — **halaman belum ada (T-49/OD-08)**, jangan ditautkan sebelum halamannya ada.
- Pernyataan: "Pembayaran diproses oleh Midtrans." "Kami tidak pernah meminta PIN atau OTP."
- © `[ISI DATA: tahun & nama badan hukum]`.

## 16. Kata kunci SEO (tanpa merek pesaing)

| Intent | Kata kunci |
|---|---|
| Transaksional | donasi online, sedekah online, donasi sekarang, bayar sedekah QRIS*, donasi tanpa daftar |
| Kategori/program | donasi pendidikan, donasi pembangunan masjid, sedekah anak yatim, donasi dhuafa, donasi kemanusiaan, donasi bencana |
| Informasional | cara sedekah online, cara donasi online yang aman, keutamaan sedekah (konten blog, di luar landing) |
| Kepercayaan | platform donasi amanah, donasi transparan, donasi dengan kuitansi, laporan penyaluran donasi |
| Merek | tebar kebaikan, donasi tebar kebaikan |

\* hanya bila QRIS aktif `[ISI DATA]`. Kategori mengikuti kategori yang benar-benar aktif.

## 17. Meta title & description

| | Teks | Karakter |
|---|---|---|
| Title 1 (rekomendasi) | Tebar Kebaikan — Donasi & Sedekah Online yang Amanah | 52 |
| Title 2 | Donasi Online Tanpa Daftar, Kuitansi Otomatis | 45 |
| Title 3 | Tebar Kebaikan: Sedekah Online Mudah & Transparan | 49 |
| Desc 1 (rekomendasi) | Donasi online tanpa wajib daftar. Kuitansi PDF otomatis setelah pembayaran terkonfirmasi, rincian penggunaan dana tampil di setiap program. | 139 |
| Desc 2 | Pilih program pendidikan, masjid, yatim & dhuafa, atau kemanusiaan. Bayar via Midtrans, terima kuitansi otomatis, pantau penyalurannya. | 135 |
| Desc 3 | Sedekah online yang mudah dan tercatat: tanpa biaya tambahan untuk donatur, kuitansi otomatis, dan rincian dana di setiap program. | 130 |

(Jumlah karakter dihitung dengan Python `len()`, termasuk spasi dan tanda pisah.) Title 1 = title home saat ini (tidak mengubah SERP bila route `/`).
