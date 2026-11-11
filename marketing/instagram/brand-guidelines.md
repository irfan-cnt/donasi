# Brand Guidelines Instagram — Tebar Kebaikan

> Paket P31. Panduan ini **mengikuti `docs/06-design/design-system.md`** (palet yang sudah diselaraskan dengan logo, commit `fb592bb`). Teks playbook P31 masih menyebut "zamrud, emas lembut, krem"; yang berlaku adalah hijau logo, oranye/kuning logo, dan latar krem dari design system. Bila design system berubah, panduan ini ikut berubah.
>
> Semua klaim harus bisa dibuktikan dari produk. Data yang belum ada di repo ditulis `[ISI DATA]` dan wajib diisi PM sebelum tayang.

## 1. Suara & nada

**Kepribadian:** hangat, tenang, jujur, Islami secara halus.

| Kami | Kami bukan |
|---|---|
| Hangat, menyapa dengan "kamu" (sama dengan copy situs) | Kaku, birokratis |
| Tenang dan meyakinkan lewat fakta (kuitansi, rincian penyaluran) | Mendesak, menakut-nakuti ("tinggal 1 jam lagi!" tanpa dasar) |
| Kalimat pendek, jelas, mudah dibaca di HP | Paragraf panjang, jargon teknis |
| Menghormati penerima manfaat sebagai manusia bermartabat | Menjual rasa iba, kesedihan berlebihan |
| Salam & doa singkat di momen yang pas | Ceramah panjang, mengutip dalil tanpa sumber |

**Salam dan doa yang dipakai situs/notifikasi:** "Assalamu'alaikum", "Alhamdulillah", "Jazakumullahu khairan". Pakai secukupnya, jangan di setiap kalimat.

**Dalil:** jangan menulis ayat/hadis dari ingatan. Bila perlu, cantumkan rujukan persis dan tandai `[VERIFIKASI: teks & terjemahan resmi]` sampai PM/ustaz memeriksanya. Lebih disarankan memakai ajakan umum tanpa kutipan.

## 2. Kosakata

| Pakai | Hindari | Catatan |
|---|---|---|
| **program** | campaign (di konten publik) | "campaign" hanya istilah internal admin |
| **donasi**, berdonasi | "sumbangan" sebagai istilah utama | boleh variasi "sedekah" untuk ajakan umum, tidak untuk menyebut fitur |
| **donatur** / "kamu" / "#SahabatKebaikan" `[ISI DATA: sapaan komunitas final]` | "customer", "user" | |
| **penerima manfaat** | "korban" sebagai label orang, "orang miskin" | "korban banjir" boleh untuk konteks bencana, tetap hormat |
| **Hamba Allah** | "anonim", "tanpa nama" | nama tampil untuk donatur yang memilih tidak menampilkan nama |
| **kuitansi** | "nota", "struk" | kuitansi PDF terbit setelah pembayaran terkonfirmasi |
| **rincian penyaluran dana** / laporan penyaluran | "laporan keuangan resmi/teraudit" | jangan klaim audit bila belum ada `[ISI DATA]` |
| **terkumpul** | "omzet", "pendapatan" | |
| **doa** (pesan donatur) | "komentar" | |
| **metode pembayaran** (QRIS, e-wallet, virtual account) | menyebut metode yang tidak aktif | daftar aktif mengikuti akun Midtrans `[ISI DATA]` |
| **lembaga** / nama lembaga `[ISI DATA: nama badan hukum]` | "kami terdaftar resmi di …" tanpa bukti | izin PUB / legalitas = OD-02, belum diputuskan |

## 3. Do & Don't

**Do**
- Arahkan ke halaman program (`/campaign/...`) atau daftar program (`/campaign`).
- Sebut hal yang memang ada di produk: donasi tanpa wajib daftar akun (tamu), login Google opsional, kuitansi PDF, status pembayaran dikonfirmasi penyedia pembayaran, rincian penyaluran di halaman program, pilihan tampil sebagai Hamba Allah.
- Pakai angka hanya dari dashboard admin/data produksi, sertakan tanggal data ("per [ISI DATA: tanggal]").
- Minta izin tertulis sebelum menampilkan wajah atau cerita penerima manfaat.
- Cantumkan alt text di setiap posting.

**Don't**
- Jangan mengarang angka, testimoni, mitra, sertifikasi, izin, atau penghargaan.
- Jangan menjanjikan fitur di luar scope MVP: donasi rutin/otomatis, kalkulator zakat, qurban, aplikasi mobile, penggalangan oleh fundraiser, refund otomatis.
- Jangan memakai logo bank, e-wallet, Midtrans, atau merek pihak lain di desain.
- Jangan menyalin teks, visual, atau gaya khas platform donasi lain; jangan memakai hashtag merek pesaing.
- Jangan menampilkan wajah anak, data pribadi donatur (email/WA), atau nominal donatur yang tidak memilih tampil.
- Jangan membuat logo ulang dengan AI; gunakan file logo asli.

## 4. Palet (sumber: design system)

| Peran | Token | Hex | Pemakaian di Instagram | Catatan kontras |
|---|---|---|---|---|
| Hijau utama | `--primary` | `#086828` | Judul, tombol/CTA, ikon | Teks putih di atasnya 6.95:1 (aman) |
| Hijau tua | `--primary-ink` | `#053F1E` | Latar gelap (cover, slide penutup) | Teks putih/krem sangat aman |
| Hijau terang | `--primary-bright` | `#089838` | **Dekoratif saja** (garis, motif) | 3.78:1 — jangan untuk teks |
| Oranye logo | `--brand-orange` | `#F89808` | Isian badge/CTA, sorotan | Teks di atasnya **gelap** (`#17201C`, 7.53:1); jangan putih (2.21:1) |
| Kuning logo | `--brand-yellow` | `#F8B808` | Aksen dekoratif, highlight | Teks gelap (9.41:1) |
| Oranye teks | `--gold` | `#A35200` | Label aksen berupa teks di latar terang | 5.58:1 di putih |
| Krem | `--bg` | `#FAF9F5` | Latar utama terang | |
| Krem aksen | `--gold-soft` | `#FEF3DC` | Latar kotak info/chip | |
| Hijau lembut | `--primary-soft` | `#E6F4EA` | Latar kartu, slide isi | Hijau utama di atasnya 6.12:1 |
| Tinta | `--ink` | `#17201C` | Teks utama | |
| Tinta lembut | `--ink-soft` | `#4A5550` | Paragraf | |

Proporsi yang disarankan: ±60% krem/putih, ±30% hijau, ±10% oranye/kuning. Satu sorotan oranye per slide.

## 5. Tipografi
- **Fraunces** (600–700): headline emosional, cover carousel, kutipan doa. Maksimal 1 baris Fraunces per desain.
- **Plus Jakarta Sans** (400–800): semua teks lain — subjudul, isi slide, label, angka.
- Ukuran minimum di kanvas 1080 px: isi 32 px, headline 64–96 px. Maksimal ±25 kata per slide.
- Angka nominal: format Indonesia `Rp1.250.000` (titik ribuan), tanpa desimal.

## 6. Motif & logo
- Motif bintang 8 sudut sebagai pola garis sangat tipis, opasitas 8–10%, di sudut/latar. Tanpa kaligrafi dekoratif atau ornamen berat.
- Logo: pakai file asli — `assets/brand-src/logo-icon.png` (ikon: kubah hijau, dua tangan hijau menadah hati kuning-oranye, gelombang oranye), `assets/brand-src/logo-wide.png` (ikon + tulisan "Tebar" hijau "Kebaikan" oranye), turunan di `public/brand/`.
- Logo ditempel **setelah** gambar dibuat. Gambar AI tidak boleh berisi logo atau tulisan merek hasil generate.
- Posisi logo: pojok kanan/kiri bawah di dalam safe area, lebar logo wide ±220–280 px pada kanvas 1080.

## 7. Aturan foto
1. **Martabat dulu.** Tampilkan penerima manfaat sebagai orang yang berdaya, bukan objek iba. Hindari close-up tangis, luka, kondisi rumah yang dieksploitasi.
2. **Izin.** Wajah penerima manfaat hanya dengan izin tertulis (formulir persetujuan `[ISI DATA: template formulir]`), disimpan lembaga. Tanpa izin: foto dari belakang, siluet, tangan, atau objek (paket, bangunan).
3. **Anak-anak.** Jangan menampilkan wajah anak, nama lengkap, sekolah, atau lokasi spesifik yang bisa mengidentifikasi. Pakai foto tangan/dari belakang.
4. **Lokasi.** Jangan menyebut alamat rumah penerima manfaat; cukup kota/kabupaten bila diizinkan.
5. **Foto asli vs ilustrasi.** Foto dokumentasi program harus asli. Gambar AI hanya untuk ilustrasi/latar dan **tidak boleh** dipakai seolah dokumentasi nyata; beri label "ilustrasi" bila berpotensi disalahpahami.
6. **Donatur.** Jangan menampilkan email, nomor WA, atau nama donatur yang memilih Hamba Allah.

## 8. Dimensi & safe area

| Format | Ukuran | Safe area teks/logo |
|---|---|---|
| Feed persegi | 1080×1080 | margin 80 px semua sisi |
| Feed portrait / carousel | 1080×1350 (4:5) | margin 80 px; pratinjau grid profil memotong ke ±1080×1440 tengah (3:4) — taruh headline di tengah-atas, bukan di tepi atas/bawah |
| Story / Reels | 1080×1920 (9:16) | kosongkan 250 px atas & 340 px bawah (UI Instagram), margin samping 80 px |

Format default paket ini: carousel & feed 1080×1350; foto profil 1080×1080 (ditampilkan bulat — elemen penting di lingkaran tengah ±80%).
