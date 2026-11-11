# Voiceover ElevenLabs — Reels IG-RL-01

> Paket P32. Naskah untuk `reels-script.md`. Klaim sama persis dengan Reel; jangan menambah klaim saat merekam ulang.
>
> **Suara:** gunakan voice stok/pustaka yang lisensinya mengizinkan pemakaian komersial, atau suara milik sendiri (anggota tim yang memberi persetujuan tertulis). **Dilarang mengkloning suara orang nyata (ustaz, tokoh, influencer, siapa pun) tanpa persetujuan tertulis dari orang tersebut.** Catat nama voice, paket langganan, dan ketentuan lisensinya di arsip aset `[ISI DATA: lokasi arsip lisensi]`.
>
> Audio diproduksi manual oleh tim; hasil final disetujui PM sebelum dipakai.

## 1. Arahan suara

| Aspek | Arahan |
|---|---|
| Gender / usia | Netral terhadap pilihan tim; saran awal: suara dewasa 25–40 tahun, laki-laki **atau** perempuan `[ISI DATA: pilihan PM]` |
| Nada | Hangat, tenang, ramah — seperti teman yang menjelaskan, bukan iklan yang berteriak |
| Tempo | ±2,3 kata/detik (±140 kata/menit), sedikit lebih lambat di kalimat penutup |
| Logat | Bahasa Indonesia baku-santai, artikulasi jelas, tanpa logat daerah kental |
| Hindari | Nada dramatis/sedih, intonasi "jualan", tertawa, bisikan |

## 2. Pengaturan yang disarankan (titik awal, setel dengan telinga)

Nama parameter, rentang, dan ketersediaannya **bergantung pada model/versi ElevenLabs yang dipakai** — cek di UI/dokumentasi ElevenLabs terbaru sebelum produksi. Angka di bawah hanya titik awal, bukan nilai pasti.

| Parameter (nama umum di UI) | Titik awal | Arah penyetelan |
|---|---|---|
| Stability | ±40–60% | Naikkan bila suara naik-turun berlebihan; turunkan bila terdengar datar/robotik |
| Similarity (clarity + similarity enhancement) | ±70–85% | Turunkan bila muncul artefak/desis |
| Style (style exaggeration), bila tersedia | ±0–20% | Biarkan rendah; nada hangat cukup dari pilihan voice |
| Speaker boost, bila tersedia | Aktif | Matikan bila terdengar tajam |
| Kecepatan (speed), bila tersedia | Default, lalu sesuaikan agar durasi pas | |

Proses: generate 2–3 take per paragraf, pilih yang paling natural, gabungkan di editor. Ekspor WAV/MP3 kualitas tertinggi yang tersedia; normalisasi VO ke sekitar −16 LUFS sebelum dicampur dengan musik.

## 3. Penanda jeda

Penanda di naskah ini adalah **penanda untuk editor/operator**:
- `/` = jeda pendek ±0,3 dtk · `//` = jeda ±0,6 dtk · `///` = jeda ±1 dtk.

Cara paling aman: biarkan tanda baca (koma, titik) memberi jeda alami, lalu atur jeda panjang di editor audio dengan memotong/menyambung take. ElevenLabs pernah mendukung tag jeda seperti `<break time="0.6s" />` di sebagian model — **verify in current docs** (dukungan, batas durasi, dan model yang mendukung bisa berubah). Jangan kirim penanda `/` ke ElevenLabs.

## 4. Naskah final — 40 detik (versi utama Reel)

```
[S1] Mau berdonasi, / tapi ingin tahu ke mana uangnya pergi? //
[S2] Kenalkan, / Tebar Kebaikan. / Tempat berdonasi online untuk pendidikan, kesehatan, masjid, kemanusiaan, / dan lainnya. //
[S3] Pilih program, / tentukan nominal. / Tidak wajib membuat akun. // Tidak ingin namamu tampil? / Pilih tampil sebagai Hamba Allah. //
[S4] Bayar lewat QRIS, e-wallet, / atau virtual account. / Status pembayaran dikonfirmasi oleh penyedia pembayaran. //
[S5] Setelah pembayaran terkonfirmasi, / kuitansi PDF terbit untukmu. //
[S6] Rincian penyaluran dananya / bisa kamu cek di halaman program. ///
[S7] Mulai tebar kebaikan, / link ada di bio. // Jazakumullahu khairan.
```

- **Jumlah kata:** 77 · **Estimasi:** 77 ÷ 2,3 ≈ 33,5 dtk bicara + ±5,5 dtk jeda ≈ **39–40 dtk** (bila melebihi 40 dtk, perpendek jeda `///` di S6 atau naikkan speed sedikit).
- Metode pembayaran mengikuti metode aktif `[ISI DATA: metode aktif]`; bila salah satu tidak aktif, hapus dari kalimat S4 dan subtitle.

## 5. Versi 30 detik

```
Ingin berdonasi, / dan tahu ke mana uangnya pergi? //
Kenalkan, / Tebar Kebaikan. //
Pilih program, / tidak wajib membuat akun. /
Bayar lewat QRIS, e-wallet, atau virtual account, / statusnya dikonfirmasi oleh penyedia pembayaran. //
Kuitansi PDF terbit setelah pembayaran terkonfirmasi, / dan rincian penyaluran dana bisa kamu cek di halaman program. //
Link ada di bio.
```

- **Jumlah kata:** 49 · **Estimasi:** 49 ÷ 2,3 ≈ 21 dtk bicara + ±4 dtk jeda ≈ **25–27 dtk** (sisa untuk logo penutup).
- Pemakaian: potongan Reel/iklan 30 dtk — buang S3 bagian Hamba Allah dan pendekkan S2; visual mengikuti adegan yang sama.

## 6. Versi 15 detik

```
Kenalkan, / Tebar Kebaikan. /
Donasi online tanpa wajib membuat akun, / kuitansi PDF setelah pembayaran terkonfirmasi, / dan rincian penyaluran di halaman program. //
Link di bio.
```

- **Jumlah kata:** 23 · **Estimasi:** 23 ÷ 2,3 ≈ 10 dtk bicara + ±2 dtk jeda ≈ **12–13 dtk**.
- Pemakaian: Story (H+12 di `content-calendar.md`) memakai adegan S2, S3, S5, S6, S7 yang dipersingkat.

## 7. Catatan pelafalan

Respelling sederhana dengan suku kata; huruf kapital = tekanan ringan. Bila TTS salah melafalkan, ketik ejaan respelling di naskah ElevenLabs (bukan di subtitle).

| Istilah | Dipakai di | Respelling | Catatan |
|---|---|---|---|
| Jazakumullahu khairan | VO 40 dtk (penutup) | ja-ZA-ku-mul-LAH-hu KHAI-ran | Ungkapan yang dipakai situs/notifikasi (brand-guidelines §1). "kh" seperti "kh" pada "khusus" |
| Jazakallah khairan | Tidak dipakai di naskah (alternatif untuk satu orang laki-laki) | ja-ZAA-kal-LAAH KHAI-ran | Bila PM memilih versi ini, ganti juga di subtitle & caption agar konsisten |
| Sedekah | Hashtag/caption; cadangan bila naskah diubah | se-DE-kah | "e" pertama pepet seperti "sedang"; "kah" jelas, bukan "ka" |
| Hamba Allah | VO S3 | HAM-ba al-LAH | "Allah" dengan "l" ganda tebal, jangan "ala" |
| Assalamu'alaikum | Cadangan pembuka | as-sa-LAA-mu a-LAI-kum | Ada hentian kecil (glotal) sebelum "a-lai" |
| QRIS | VO S4 | KRIS | Dibaca satu kata seperti "kris" (umum di Indonesia); bila TTS mengeja huruf, tulis "kris" |
| e-wallet | VO S4 | i-WO-let | |
| PDF | VO S5 | pe-de-ef | Ejaan huruf Indonesia; bila TTS membaca Inggris, tulis "pe de ef" |
| online | VO S2 | ON-lain | |

Lafal istilah Arab sebaiknya didengar dulu oleh `[ISI DATA: reviewer, mis. ustaz/pengurus lembaga]` sebelum dipakai.
