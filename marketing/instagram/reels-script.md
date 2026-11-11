# Reels Peluncuran — Tebar Kebaikan (IG-RL-01)

> Paket P32. Mengikuti `brand-guidelines.md` (suara, kosakata, palet, safe area §8) dan `image-prompts.md` (blok gaya bersama + `NEG-BASE`). Semua klaim berasal dari fitur yang ada di repo; data yang belum ada ditulis `[ISI DATA]`.
>
> **Status:** draf, menunggu persetujuan PM. Pengunggahan ke Instagram dilakukan manual oleh tim setelah PM menyetujui — tidak ada posting otomatis.

## 1. Ringkasan

| Item | Nilai |
|---|---|
| ID | `IG-RL-01` |
| Durasi | **40 detik** (7 adegan) |
| Rasio | 9:16 · 1080×1920 |
| Tayang | H+0 (hari peluncuran, `[ISI DATA: tanggal launch]`) — lihat `content-calendar.md` |
| Voiceover | `elevenlabs-voiceover.md` (versi 40 dtk; potongan 30 & 15 dtk) |

## 2. Konsep

**"Kebaikanmu, bisa kamu ikuti jejaknya."** Reel memperkenalkan Tebar Kebaikan lewat perjalanan satu donasi: pilih program → bayar → status dikonfirmasi → kuitansi → rincian penyaluran. Visual ilustrasi flat yang tenang (bukan dokumentasi nyata), tangan tanpa wajah, palet logo. Nada hangat dan tenang; tidak menjual rasa iba, tidak ada hitung mundur mendesak.

Pesan inti yang harus tertangkap tanpa suara (banyak penonton menonton tanpa audio — teks layar wajib membawa pesan sendiri):
1. Donasi online untuk berbagai program.
2. Tidak wajib membuat akun; bisa tampil sebagai Hamba Allah.
3. Status pembayaran dikonfirmasi penyedia pembayaran; kuitansi PDF terbit setelahnya.
4. Rincian penyaluran dana tampil di halaman program.

## 3. Hook (0–3 detik)

- **Visual:** tangan meletakkan amplop bercahaya ke kotak kayu polos, lalu jejak cahaya keemasan mulai bergerak keluar dari kotak.
- **Teks layar:** **"Donasimu sampai ke mana?"**
- **VO:** "Mau berdonasi, tapi ingin tahu ke mana uangnya pergi?"
- **Alasan:** pertanyaan yang dirasakan calon donatur, dijawab sepanjang video — tanpa angka, tanpa klaim, tanpa menakut-nakuti.

## 4. Storyboard

| # | Waktu | Durasi | Visual | Teks layar | Transisi ke berikut | Prompt |
|---|---|---|---|---|---|---|
| S1 | 0:00–0:03 | 3 dtk | Tangan memasukkan amplop bercahaya ke kotak kayu polos; partikel emas mulai naik. Zoom-in pelan. | **Donasimu sampai ke mana?** | Partikel emas "mengalir" ke adegan berikut (match cut) | `IG-RL-01-S1` |
| S2 | 0:03–0:09 | 6 dtk | Dua tangan menadah cahaya berbentuk hati; ikon kategori (buku, detak jantung, kubah, paket, awan hujan) muncul satu per satu mengelilingi. Logo wide ditempel di detik 0:05. | **Tebar Kebaikan** · *donasi online untuk banyak program* | Slide ke atas (push) | `IG-RL-01-S2` |
| S3 | 0:09–0:17 | 8 dtk | Ponsel dengan kartu program abstrak; jari menekan tombol oranye; toggle hijau menyala. | **Tanpa wajib daftar akun** → (0:13) **Boleh tampil sebagai "Hamba Allah"** | Cut on action (ketukan jari) | `IG-RL-01-S3` |
| S4 | 0:17–0:24 | 7 dtk | Tiga ubin ikon generik (kotak QR, dompet, gedung bank) lalu cincin progres hijau berubah menjadi tanda centang. | **QRIS · e-wallet · virtual account** `[ISI DATA: metode aktif]` → (0:20) **Status dikonfirmasi penyedia pembayaran** | Centang "membesar" menjadi dokumen | `IG-RL-01-S4` |
| S5 | 0:24–0:30 | 6 dtk | Dokumen polos dengan stempel centang hijau melayang ke amplop email dan ikon unduh. | **Kuitansi PDF setelah pembayaran terkonfirmasi** | Dissolve lembut (8–10 frame) | `IG-RL-01-S5` |
| S6 | 0:30–0:36 | 6 dtk | Kartu daftar empat baris abstrak dengan ikon kalender; kaca pembesar hijau melintas pelan. | **Cek rincian penyaluran dana di halaman program** | Fade ke hijau tua | `IG-RL-01-S6` |
| S7 | 0:36–0:40 | 4 dtk | Latar hijau tua, partikel emas membentuk garis bintang 8 sudut; logo wide (file asli) muncul di tengah. | **Mulai tebar kebaikan** · *Link di bio* | — (akhir; frame terakhir ditahan 0,5 dtk) | `IG-RL-01-S7` |

**Total: 3 + 6 + 8 + 7 + 6 + 6 + 4 = 40 detik.**

Catatan klaim:
- S4: nama metode harus sesuai metode yang aktif di akun Midtrans saat tayang `[ISI DATA: metode aktif]`; hapus yang tidak aktif dari teks dan VO. Jangan menampilkan logo bank/e-wallet/Midtrans.
- S5: kuitansi terbit **setelah** pembayaran terkonfirmasi — jangan disingkat menjadi "langsung dapat kuitansi".
- S6: rincian penyaluran adalah catatan lembaga di halaman program, bukan "laporan teraudit".

## 5. Prompt visual per adegan

Prompt lengkap ada di `image-prompts.md` bagian **Reels**. Semua: rasio **9:16 (1080×1920)**, tambahkan blok gaya bersama, negative `NEG-BASE`. Komposisi menyisakan 250 px atas dan 340 px bawah tanpa elemen penting. Bila memakai generator video (image-to-video), gunakan gambar hasil prompt sebagai frame awal dan gerak kamera pelan saja; tanpa teks/logo hasil AI.

| ID | Adegan |
|---|---|
| `IG-RL-01-S1` … `IG-RL-01-S7` | S1–S7 di atas |
| `IG-RL-01-CV` | Cover Reel (§12) |

## 6. Naskah voiceover

Nada hangat-tenang, tempo ±2,3 kata/detik. Versi final dengan penanda jeda di `elevenlabs-voiceover.md`.

| Adegan | VO |
|---|---|
| S1 | Mau berdonasi, tapi ingin tahu ke mana uangnya pergi? |
| S2 | Kenalkan, Tebar Kebaikan. Tempat berdonasi online untuk pendidikan, kesehatan, masjid, kemanusiaan, dan lainnya. |
| S3 | Pilih program, tentukan nominal. Tidak wajib membuat akun. Tidak ingin namamu tampil? Pilih tampil sebagai Hamba Allah. |
| S4 | Bayar lewat QRIS, e-wallet, atau virtual account. Status pembayaran dikonfirmasi oleh penyedia pembayaran. |
| S5 | Setelah pembayaran terkonfirmasi, kuitansi PDF terbit untukmu. |
| S6 | Rincian penyaluran dananya bisa kamu cek di halaman program. |
| S7 | Mulai tebar kebaikan, link ada di bio. Jazakumullahu khairan. |

## 7. Subtitle (SRT)

Subtitle dibakar (burn-in) **dan** diunggah sebagai file `.srt` bila fitur teks Instagram dipakai. Isi subtitle = VO kata per kata. Posisi: di atas zona bawah 340 px, tidak menumpuk dengan teks layar (teks layar di sepertiga atas–tengah, subtitle di sepertiga bawah).

```srt
1
00:00:00,200 --> 00:00:02,900
Mau berdonasi, tapi ingin tahu
ke mana uangnya pergi?

2
00:00:03,200 --> 00:00:05,000
Kenalkan, Tebar Kebaikan.

3
00:00:05,100 --> 00:00:08,800
Tempat berdonasi online untuk pendidikan,
kesehatan, masjid, kemanusiaan, dan lainnya.

4
00:00:09,200 --> 00:00:12,800
Pilih program, tentukan nominal.
Tidak wajib membuat akun.

5
00:00:13,000 --> 00:00:16,800
Tidak ingin namamu tampil?
Pilih tampil sebagai Hamba Allah.

6
00:00:17,200 --> 00:00:19,900
Bayar lewat QRIS, e-wallet,
atau virtual account.

7
00:00:20,100 --> 00:00:23,800
Status pembayaran dikonfirmasi
oleh penyedia pembayaran.

8
00:00:24,200 --> 00:00:29,600
Setelah pembayaran terkonfirmasi,
kuitansi PDF terbit untukmu.

9
00:00:30,200 --> 00:00:35,600
Rincian penyaluran dananya
bisa kamu cek di halaman program.

10
00:00:36,000 --> 00:00:38,200
Mulai tebar kebaikan, link ada di bio.

11
00:00:38,300 --> 00:00:39,800
Jazakumullahu khairan.
```

Timecode final disesuaikan dengan audio ElevenLabs yang sudah jadi (geser per baris, jangan memotong kata).

## 8. Musik latar

- **Mood:** tenang, hangat, penuh harap; tidak sedih/melankolis, tidak epik.
- **Tempo:** ±70–90 BPM, dinamika datar dengan sedikit "lift" lembut di S6–S7.
- **Instrumen:** piano lembut atau gitar akustik petik, pad/string tipis; tanpa vokal, tanpa lirik. Bila tim/dewan syariah lembaga lebih memilih tanpa alat musik `[ISI DATA: kebijakan musik lembaga]`, ganti dengan ambience lembut (angin, suara alam) atau vokal humming/nasyid tanpa instrumen yang berlisensi.
- **Level:** −18 s.d. −22 dB di bawah VO (ducking saat VO berbicara); naik pelan di 2 detik terakhir.
- **Lisensi:** hanya musik bebas royalti dengan lisensi yang **mengizinkan pemakaian komersial di media sosial** (termasuk akun organisasi/lembaga). Simpan bukti lisensi (nama trek, sumber, nomor/tanggal lisensi) di folder aset `[ISI DATA: lokasi arsip lisensi]`. Musik dari pustaka audio di dalam aplikasi Instagram boleh dipakai sesuai ketentuan Instagram yang berlaku saat unggah, tetapi untuk akun bisnis pilihannya bisa terbatas — cek saat unggah. Jangan memakai lagu populer/berhak cipta.

## 9. Instruksi editing

1. **Kanvas:** 1080×1920, 9:16, 30 fps, H.264, audio AAC 48 kHz. Ekspor ≤ batas ukuran Instagram yang berlaku.
2. **Safe zone (brand-guidelines §8):** kosongkan **250 px atas** dan **340 px bawah**, margin samping **80 px**. Semua teks layar, subtitle, dan logo di dalam area ±920×1330 tengah. Hindari juga sisi kanan bawah (tombol like/komentar/bagikan) — geser teks sedikit ke kiri bila perlu.
3. **Tipografi:** teks layar utama Plus Jakarta Sans 700, 56–72 px; satu baris Fraunces hanya di S2 ("Tebar Kebaikan") atau S7. Subtitle Plus Jakarta Sans 600, 40–44 px, putih dengan kotak semi-transparan `#053F1E` 70% atau tinta `#17201C` di atas latar terang.
4. **Warna teks:** putih di atas hijau `#086828`/`#053F1E`; teks gelap `#17201C` di atas oranye/kuning (jangan putih di atas oranye — kontras 2.21:1).
5. **Logo:** file asli `assets/brand-src/logo-wide.png` (S2, S7) dan opsional `logo-icon.png` kecil di pojok bawah-kiri dalam safe area. Jangan pakai logo hasil AI.
6. **Gerak:** kamera pelan (zoom/pan ≤10%), animasi teks fade/slide 6–8 frame. Tanpa efek glitch/flash.
7. **Label:** tambahkan teks kecil "Ilustrasi" di pojok bila ada visual yang bisa disangka dokumentasi nyata (brand-guidelines §7.5).
8. **Cek akhir:** tonton tanpa suara (pesan tetap utuh?), tonton di HP dengan UI Instagram (teks tidak tertutup?), ejaan subtitle sama dengan VO.

## 10. Caption

> Assalamu'alaikum, Sahabat.
>
> Tebar Kebaikan resmi hadir. 🌱
>
> Di sini kamu bisa berdonasi online untuk program pendidikan, kesehatan, masjid, kemanusiaan, dan lainnya:
> ✅ Tidak wajib membuat akun
> ✅ Bisa tampil sebagai "Hamba Allah"
> ✅ Status pembayaran dikonfirmasi oleh penyedia pembayaran
> ✅ Kuitansi PDF setelah pembayaran terkonfirmasi
> ✅ Rincian penyaluran dana di halaman program
>
> Mulai tebar kebaikan lewat link di bio.
> Jazakumullahu khairan. 🤲

**Alt text / deskripsi aksesibilitas:** "Video ilustrasi: tangan memasukkan amplop bercahaya ke kotak, lalu alur donasi di ponsel — memilih program, membayar, status terkonfirmasi, kuitansi PDF, dan rincian penyaluran di halaman program. Ditutup logo Tebar Kebaikan dan ajakan: link di bio."

## 11. CTA & hashtag

- **CTA layar:** "Mulai tebar kebaikan · Link di bio"
- **CTA caption:** "Mulai tebar kebaikan lewat link di bio." (tautan #1 di `profile.md` §6)
- **Hashtag (12):** `#TebarKebaikan #donasionline #sedekah #sedekahonline #berbagi #kebaikan #donasi #donasiamanah #transparansidonasi #caradonasi #berbagikebaikan #ayoberbagi`

## 12. Desain cover (IG-RL-01-CV)

- **Ukuran:** 1080×1920; pratinjau grid profil memotong ke tengah (±3:4) — taruh judul dan elemen kunci di **tengah**, bukan tepi atas/bawah.
- **Latar:** hijau tua `#053F1E` dengan visual `IG-RL-01-CV` (amplop bercahaya + motif bintang 8 sudut tipis).
- **Judul (Fraunces 700, krem/putih, ±96 px, 2 baris):** "Donasimu sampai ke mana?"
- **Sub (Plus Jakarta Sans 600, 44 px):** "Kenalan dengan Tebar Kebaikan"
- **Badge:** pil oranye `#F89808` teks `#17201C` "Baru" (opsional).
- **Logo:** wide asli di bawah judul, masih di dalam crop tengah.
