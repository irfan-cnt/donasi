# Business Rules

## Campaign
- **BR-01** Status campaign: `draft → published ⇄ paused → completed → archived`. `draft` hanya bisa ke `published` atau dihapus. `archived` final (tidak tampil publik).
  - > **Catatan P21 (deviasi):** arsip dari `draft`/`published`/`paused` diizinkan (P21 #3: campaign yang tidak bisa dihapus permanen diarsipkan) — menunggu konfirmasi PM.
- **BR-02** Campaign `published` wajib punya: judul, slug unik, ringkasan, deskripsi, gambar utama (dengan alt), kategori, tipe nominal valid.
- **BR-03** Campaign menerima donasi bila: `status = published` AND (`start_at` NULL atau ≤ now) AND (`end_at` NULL atau > now).
- **BR-04** Target penggalangan (`target_amount`) opsional dan **independen** dari tipe nominal. Tanpa target → UI menampilkan "Terkumpul Rp X" tanpa progress bar persentase.
- **BR-04a** Campaign tidak otomatis ditutup saat target tercapai (default). Job harian mengubah ke `completed` bila `end_at` terlewati.

## Nominal donasi
- **BR-05** Semua nominal dalam **rupiah integer** (`bigint`), tanpa pecahan.
- **BR-06** Open amount: `min_amount` default Rp10.000 (wajib ≥ Rp1.000 karena batas provider), `max_amount` opsional (default platform Rp100.000.000), `suggested_amounts` 0–6 nilai dalam rentang [min, max].
- **BR-07** Fixed amount: minimal 1 paket aktif; donatur hanya boleh memilih paket `is_active = true` milik campaign tersebut; nominal diambil **dari database**, bukan dari client.
- **BR-08** Nominal maksimum absolut platform: Rp1.000.000.000 per transaksi (batas aman; dapat diubah di `platform_settings`).
- **BR-09** Nominal juga harus memenuhi min/max metode pembayaran yang dipilih (dicek di Select Payment).

## Transaksi & pembayaran
- **BR-10** Kode transaksi: `TK-YYMMDD-XXXXXX` (6 karakter base32 Crockford acak). ID internal UUIDv7.
- **BR-11** Satu transaksi = satu campaign = satu nominal. Satu transaksi dapat memiliki beberapa *payment attempt*, tetapi maksimal **satu** yang `pending` atau `paid`.
- **BR-12** Snapshot disimpan di transaksi: judul campaign, nama/email/WA donatur, anonim, doa — agar riwayat tetap akurat walau data berubah.
- **BR-13** Biaya metode pembayaran ditanggung lembaga secara default (donatur membayar nominal tepat). **Diputuskan OD-04 (10 Nov 2026):** lembaga menanggung biaya; opsi "donatur menanggung biaya" tidak dibangun di MVP (`fee_borne_by` tetap `platform`).
- **BR-14** Masa berlaku pembayaran default: VA 24 jam, QRIS 15 menit, e-wallet 15 menit (dapat diatur per metode, dibatasi kemampuan provider).
- **BR-15** Transaksi `created` tanpa payment selama 24 jam → `cancelled` oleh job.
- **BR-16** Fallback provider hanya bila metode setara aktif di provider lain; dicatat di `payments.fallback_from_id`. **Nonaktif di MVP** (Midtrans-only, OD-03).
- **BR-17** Ganti metode: payment pending lama di-expire ke provider lebih dulu; bila expire gagal dan kemudian dibayar, kedua payment tetap dicatat dan kelebihan ditandai `needs_review` (tidak menambah total dua kali untuk satu transaksi; selisih dicatat sebagai temuan rekonsiliasi untuk refund manual).
- **BR-18** Status hanya berubah dari webhook terverifikasi, rekonsiliasi API provider, atau job expiry yang telah mengecek provider. Redirect URL **tidak pernah** mengubah status.
- **BR-19** Total campaign (`collected_amount`, `donor_count`) hanya bertambah pada transisi pertama transaksi ke `paid`, dalam DB transaction yang sama, dengan guard `WHERE status <> 'paid'`.
- **BR-20** State machine payment: `created → pending → {paid, expired, failed, cancelled}`; `paid → refunded` (masa depan). Transisi lain ditolak dan dicatat sebagai anomali. Event yang datang terlambat (mis. `expired` setelah `paid`) diabaikan.
- **BR-21** Refund tidak diotomasi di MVP; bila terjadi, dicatat manual oleh `finance` dengan alasan, mengurangi total campaign, dan masuk audit log.

## Donatur & privasi
- **BR-22** Donatur anonim tampil sebagai "Hamba Allah" di publik; admin tetap melihat nama asli.
- **BR-23** Daftar donatur publik hanya menampilkan nama tampil (atau Hamba Allah), nominal, doa (setelah filter kata kasar), waktu relatif. Email/WA tidak pernah tampil publik.
- **BR-24** Identitas donor dikenali per email ternormalisasi (lowercase, trim). Tamu dengan email sama = satu record `donors`.
- **BR-25** Klaim transaksi tamu hanya untuk email Google terverifikasi yang sama persis.
- **BR-26** WhatsApp hanya dikirim bila donatur memberi consent eksplisit pada transaksi atau di profil.

## Kuitansi
- **BR-27** Kuitansi hanya untuk transaksi `paid`; nomor `KW/{YYYY}/{seq 6 digit}` berurutan tanpa celah per tahun (sequence di DB, dibuat saat transisi ke paid).
- **BR-28** Isi kuitansi immutable; perubahan data donatur setelahnya tidak mengubah kuitansi yang sudah terbit.

## Notifikasi
- **BR-30** Satu template aktif per (event, kanal). Bila tidak ada template aktif → notifikasi kanal itu dilewati dan dicatat `skipped`.
- **BR-31** Kegagalan notifikasi tidak me-rollback pembayaran.
- **BR-32** Notifikasi dedup per (event, transaksi, kanal) — tidak mengirim "Payment Success" dua kali.

## Admin
- **BR-40** Permission awal:

| Permission | owner | admin | finance | editor |
|---|---|---|---|---|
| campaigns.read/write | ✅ | ✅ | read | ✅ |
| campaigns.publish | ✅ | ✅ | ➖ | ➖ |
| news.write/publish | ✅ | ✅ | ➖ | ✅ |
| transactions.read | ✅ | ✅ | ✅ | ➖ |
| transactions.export | ✅ | ✅ | ✅ | ➖ |
| transactions.reconcile | ✅ | ✅ | ✅ | ➖ |
| donors.read | ✅ | ✅ | ✅ | ➖ |
| donors.export | ✅ | ➖ | ✅ | ➖ |
| payment_methods.write | ✅ | ➖ | ✅ | ➖ |
| disbursements.write | ✅ | ✅ | ✅ | ➖ |
| notifications.write | ✅ | ✅ | ➖ | ➖ |
| settings.write / admins.manage | ✅ | ➖ | ➖ | ➖ |
| audit.read | ✅ | ✅ | ✅ | ➖ |

- **BR-41** Admin tidak dapat menandai transaksi `paid` secara manual.
- **BR-42** Minimal satu `owner` aktif harus selalu ada.
- **BR-43** Rincian penyaluran dana (OD-06): nominal `bigint` rupiah > 0; total penyaluran per campaign tidak boleh melebihi `collected_amount`; setiap perubahan masuk audit log; entri dihapus secara soft delete (tidak hard delete).
  - > **Catatan P21:** penyaluran hanya untuk campaign non-draft; berita bukti wajib terbit & milik campaign yang sama. Celah diketahui: refund belum menurunkan `collected_amount` (alur refund belum dirancang), sehingga batas ini bisa longgar setelah refund.
