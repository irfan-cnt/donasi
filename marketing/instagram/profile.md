# Profil Instagram — Tebar Kebaikan

> Mengikuti `brand-guidelines.md`. Situs belum live (P24–P30 belum dikerjakan); semua tautan memakai domain `[ISI DATA: domain produksi]`.

## 1. Foto profil (IG-PF-01)

**Rekomendasi utama: pakai file logo asli, bukan gambar generate.**
- Sumber: `assets/brand-src/logo-icon.png` (ikon tanpa tulisan — tulisan tidak terbaca di lingkaran 110 px).
- Komposisi: ikon di tengah kanvas 1080×1080, lebar ikon ±70% kanvas agar kubah dan gelombang tidak terpotong lingkaran.
- Latar: krem `#FAF9F5` polos (opsi B: putih `#FFFFFF`). Jangan latar hijau tua — kubah hijau logo akan tenggelam.
- Opsional: motif bintang 8 sudut garis tipis `#086828` opasitas 8% di tepi latar.
- Ekspor PNG 1080×1080, cek pratinjau bulat di HP.

**Prompt generator (hanya untuk latar, logo ditempel manual setelahnya)** — ID `IG-PF-01`, lihat `image-prompts.md`:
> Square 1:1 background, warm cream color #FAF9F5, very subtle thin-line eight-pointed star geometric pattern in green #086828 at 8% opacity only near the outer edges, clean empty circular center area for placing a logo, soft even lighting, flat minimal, no text.

## 2. Saran username
Ketersediaan **harus dicek manual oleh PM** di aplikasi Instagram (tidak dicek otomatis).

1. `@tebarkebaikan`
2. `@tebarkebaikan.id`
3. `@tebar.kebaikan`
4. `@tebarkebaikan_official`
5. `@ayotebarkebaikan`

Kriteria: sama/sedekat mungkin dengan nama situs (`SITE_NAME = "Tebar Kebaikan"`), tanpa angka, mudah diucapkan.

## 3. Display name
`Tebar Kebaikan | Donasi Online` — nama + kata kunci agar muncul di pencarian Instagram (maks. 64 karakter).

## 4. Bio (≤150 karakter)

```
Donasi online untuk program kebaikan 🌱
Bayar via QRIS, e-wallet & virtual account
Kuitansi PDF + rincian penyaluran dana
👇 Pilih program
```

Jumlah karakter: **136** (termasuk 3 baris baru dan emoji dihitung 1 karakter; diverifikasi dengan skrip penghitung karakter).

Catatan klaim: metode pembayaran mengikuti `docs/03-technical/payment-architecture.md` §8; pastikan minimal satu metode di tiap kelompok aktif di akun Midtrans produksi `[ISI DATA: metode aktif]` sebelum bio tayang, atau hapus baris itu.

## 5. CTA
- Tombol profil: **"Lihat program"** → tautan bio.
- Tombol kontak (opsional): Email/WhatsApp lembaga `[ISI DATA: kontak resmi]` — sama dengan halaman `/kontak`.
- CTA caption standar: "Donasi lewat link di bio" / "Cek rincian penyaluran di halaman program."

## 6. Strategi link-in-bio
Instagram mendukung beberapa tautan di bio. Pakai maksimal 3, urutan tetap:

| # | Judul tautan | Tujuan | Catatan |
|---|---|---|---|
| 1 | Semua program | `https://[ISI DATA: domain]/` (landing/beranda) atau `/campaign` | Tautan utama, selalu di atas |
| 2 | Program pilihan | `https://[ISI DATA: domain]/campaign/[ISI DATA: slug program utama]` | Diganti mengikuti program yang sedang dipromosikan |
| 3 | Rincian penyaluran | `https://[ISI DATA: domain]/campaign/[ISI DATA: slug]#[ISI DATA: anchor bagian penyaluran]` | Rincian penyaluran tampil di halaman detail program (C9/OD-06), bukan halaman laporan terpisah |

- Tambahkan parameter UTM, mis. `?utm_source=instagram&utm_medium=bio&utm_campaign=[ISI DATA]`, bila analitik sudah dipasang `[ISI DATA: alat analitik]`.
- Jangan memakai layanan link-in-bio pihak ketiga yang menambah pelacakan tanpa ditinjau kebijakan privasi.
- Story Highlights yang disarankan: "Cara Donasi" (IG-CR-01), "Transparansi" (IG-CR-02), "Kuitansi" (IG-CR-03), "Kabar Program" (IG-CR-04), "FAQ" (IG-CR-05).
