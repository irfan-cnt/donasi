# Security

## 1. Model ancaman (ringkas, STRIDE)

| Ancaman | Contoh | Kontrol |
|---|---|---|
| Spoofing | Webhook palsu menandai paid | Signature/token + cross-check API provider |
| Spoofing | Donor mengakses admin | Auth admin terpisah, cookie terpisah, RBAC server-side |
| Tampering | Manipulasi nominal di client | Nominal dihitung ulang di server; fixed amount dari DB |
| Tampering | Redirect `?status=success` | Status hanya dari DB |
| Repudiation | Admin mengubah campaign tanpa jejak | `audit_logs` append-only |
| Info disclosure | IDOR transaksi/PDF | Ownership check, kode acak + access token, 404 |
| Info disclosure | Secret bocor ke bundle | Hanya env server, lint rule `no NEXT_PUBLIC_*SECRET*`, `server-only` import |
| DoS | Spam checkout | Rate limit Redis, honeypot, (Turnstile bila diperlukan) |
| Elevation | Editor ekspor donor | `requirePermission()` di setiap action & route |

## 2. Autentikasi
- **Donor:** Auth.js v5 Google, sesi database, cookie `__Secure-` `HttpOnly; Secure; SameSite=Lax`; `email_verified` wajib; `callbackUrl` hanya path relatif.
  - Implementasi (P04): `src/lib/auth/index.ts` (Auth.js + `requireDonor()`), sanitizer murni `src/lib/auth/callback-url.ts` (dipakai di form, server action, dan callback `redirect` Auth.js), `src/proxy.ts` hanya cek keberadaan cookie untuk `/akun/**`. Cookie: `__Secure-authjs.session-token` bila `AUTH_URL` https (`authjs.session-token` di http localhost). Env Google wajib saat `APP_ENV=production`.
- **Admin:** email + argon2id (m=19456, t=2, p=1), TOTP wajib untuk owner (disarankan semua), lockout 5 gagal/15 menit, sesi `__Host-tk_admin` (`SameSite=Strict`), idle 30 menit, absolut 8 jam, rotasi ID sesi setelah login, tabel `admin_sessions` dengan hash token (SHA-256). Reset password hanya oleh owner + paksa ganti.
  - Implementasi (P05): `src/lib/admin-auth` (`requireAdmin(permission)`, sesi, kebijakan waktu murni), `src/lib/security/{password,crypto,totp}.ts`, `src/server/services/admin-auth-service.ts`, `src/lib/audit` (`writeAudit` + diff dengan redaksi field `password|secret|token|hash`).
  - Cookie: `__Host-tk_admin` (HttpOnly, Secure, SameSite=Strict, Path=/) di preview/production; `tk_admin` tanpa Secure hanya saat `APP_ENV=development` (http localhost tidak mendukung `__Host-`). Token 32 byte acak, DB menyimpan SHA-256. Login & ganti password merotasi sesi; ganti password mencabut semua sesi lain.
  - Login pertama: ganti password wajib (`must_change_password`) → setup TOTP via QR (wajib untuk `owner`; role lain opsional/menyusul) → dashboard. `totp_secret_enc` = AES-256-GCM (`APP_ENCRYPTION_KEY`, base64 32 byte, wajib di preview/production), format `v1.iv.tag.ct`.
  - Rate limit `admin-login` 5/15 menit per IP+email (Upstash). Fallback in-memory per proses HANYA bila `APP_ENV=development` dan Upstash belum diisi. Lockout DB (`failed_login_count` → `locked_until` +15 menit) selalu berlaku; kode TOTP kosong/salah dihitung gagal. Pesan login generik (tanpa enumerasi email); email tak dikenal tetap menjalankan verifikasi argon2 dummy.
  - Audit: `admin.login`, `admin.login_failed` (reason), `admin.lockout`, `admin.password_change`, `admin.totp_enable`.
  - 403 RBAC memakai `forbidden()` (`experimental.authInterrupts`). Karena `cacheComponents`/PPR men-stream shell lebih dulu, status HTTP halaman tetap 200 dengan UI 403 dan konten tidak dirender; route handler admin (berikutnya) wajib mengembalikan status 403 eksplisit.
  - Dashboard & pencarian admin (P20): data dashboard di-query per bagian sesuai permission (`transactions.read` → KPI transaksi/grafik/transaksi terbaru; `campaigns.read` → campaign aktif/performa); bagian tanpa izin tidak di-query. Tidak ada cache data admin (`requireAdmin` → `connection()`, tanpa `"use cache"`). Transaksi terbaru hanya menampilkan nama snapshot (tanpa email/telepon). Pencarian global = server action `adminSearchAction` (requireAdmin + Zod 2–100 karakter + rate limit `admin-search` 30/menit per admin); kode transaksi butuh `transactions.read`, email (PII donatur) butuh `donors.read`, judul campaign butuh `campaigns.read`; wildcard LIKE di-escape. Badge Sandbox/Production dihitung server dari `MIDTRANS_IS_PRODUCTION`.

## 3. Otorisasi
- Fungsi `requireDonor()`, `requireAdmin(permission)` dipanggil di **setiap** server action, route handler, dan halaman server. Middleware hanya lapisan pertama.
- Query donor selalu memfilter `donor_id` dari sesi.
- Akses transaksi publik (instruksi/pending/success) memakai `access_token` 32 byte acak (hash disimpan di DB), dikirim di URL path/query hanya untuk pemilik; berlaku 7 hari; tidak pernah dicatat di log/analytics (redaksi). Implementasi (P12): `redactUrlTokens` di `src/lib/logger.ts` (msg + field bertingkat, termasuk bentuk ter-encode); halaman ber-token `noindex` + `no-referrer`; endpoint `GET /api/transactions/{code}/status` hanya `{status, paidAt}`, `no-store`, rate limit, 404 untuk token salah. `callback_url` e-wallet ke Midtrans tidak memuat token — `/transaksi/{code}/menunggu` tanpa `?t=` hanya menampilkan halaman generik tanpa data (payment-architecture.md §3c).

## 4. Validasi input
- Zod di semua boundary; `bigint` untuk nominal; batas panjang string; normalisasi email & nomor.
- Rich text news di-sanitasi (`sanitize-html`, whitelist tag) saat simpan **dan** dirender tanpa `dangerouslySetInnerHTML` dari input mentah.
- Upload gambar: tipe MIME diverifikasi (magic bytes), maks 2 MB, re-encode WebP, nama acak. (Penyimpanan: Vercel Blob — diputuskan OD-12.)

## 5. Header & browser
CSP ketat (nonce untuk script), `frame-ancestors 'none'`, HSTS (preload setelah stabil), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal. Server Actions memeriksa Origin (bawaan Next.js) — `serverActions.allowedOrigins` dibatasi domain sendiri.

## 6. Rahasia
- Semua di Vercel Environment Variables (Production & Preview terpisah), `.env*` di `.gitignore`, secret scanning GitHub + gitleaks di CI.
- Kredensial provider **tidak pernah** disimpan di DB atau dikirim ke admin UI; UI hanya menampilkan status terkonfigurasi.
- Rotasi: setiap 6 bulan atau saat staf keluar.

## 7. Data pribadi (UU PDP)
- Data minimum: nama, email, WA (opsional). Tidak mengumpulkan KTP/alamat.
- Kebijakan privasi & consent WA eksplisit.
- Hak akses/koreksi lewat profil; penghapusan akun → anonimisasi donor (transaksi finansial tetap disimpan untuk audit dengan PII dihapus/di-hash) sesuai kebijakan retensi (open decision: 5–10 tahun untuk catatan keuangan).
- Log tidak menyimpan token, secret, payload kartu.

## 8. Logging & audit
`audit_logs` append-only (tanpa UPDATE/DELETE di role aplikasi — dipaksa via GRANT), mencatat aktor, aksi, entitas, diff, IP, UA.

## 9. Checklist review keamanan per milestone
- [ ] Tidak ada secret di bundle (`grep` hasil build `.next/static`)
- [ ] Semua action punya guard (lint custom / test)
- [ ] Uji IDOR transaksi & PDF
- [ ] Uji webhook palsu, duplikat, nominal beda
- [ ] Uji rate limit checkout & login admin
- [ ] Dependabot/npm audit tanpa high/critical
- [ ] Header keamanan terpasang

### Implementasi P07 (detail campaign & berita)
- Rich text campaign/news disanitasi server-side saat render (`src/lib/sanitize.ts`, `sanitize-html`, whitelist tanpa img/script/atribut event; link diberi `rel="nofollow noopener noreferrer"`). Editor P21 tetap wajib menyanitasi saat simpan.
- JSON-LD diserialisasi via `serializeJsonLd` (escape `<`, `>`, `&`, U+2028/2029).
- Pratinjau draft: `/campaign/{slug}/pratinjau?token=…`, HMAC-SHA256 (kunci turunan `AUTH_SECRET` + label domain), berlaku 1 jam, dibandingkan `timingSafeEqual`, halaman `noindex` & tidak di-cache (`src/lib/security/preview-token*.ts`).
- Daftar donatur publik hanya memilih nama tampil/"Hamba Allah", doa, nominal, waktu — kolom email/telepon tidak pernah di-select (uji e2e grep HTML).
- `src/proxy.ts`: slug huruf besar → 301; draft/archived/slug salah → 404 sebelum streaming (memo in-process 60 s; fail-open ke soft 404 bila DB error).

### Implementasi P18 (dashboard donatur & klaim)
- **Klaim transaksi tamu** (event `signIn`, hanya email Google terverifikasi): satu DB transaction — donor tamu ber-email sama (`donors.email` UNIQUE citext) ditautkan ke user (bukan digabung); transaksi ber-`donor_email_snapshot` sama yang tercatat pada donor tamu lain (tanpa user, belum dianonimkan) dipindah. Saat ditautkan, field yang dideklarasikan tamu direset (nama = nama Google, WA NULL, opt-in WA & anonim default = false) karena siapa pun bisa checkout dengan email orang lain. Idempoten; audit `donor.guest_transactions_claimed` hanya bila ada perubahan.
- **IDOR:** semua query dashboard memfilter `donor_id` dari sesi; `/akun/donasi/[code]` milik orang lain → 404 sungguhan (proxy `donorTransactionAccess` + halaman `notFound()`); action lanjut bayar juga 404.
- **Lanjut bayar oleh pemilik:** access token hanya tersimpan hash-nya → server action (POST, requireDonor, status `created/pending`, `donor_id` sesi) menerbitkan token baru (TTL 7 hari, tautan lama di email tidak berlaku), audit `transaction.access_token_reissued`, lalu redirect ke halaman pembayaran/instruksi. Rate limit 10/jam per donor (fail-open, OD-15). Status pembayaran tidak disentuh (BR-18).
- **Profil:** Zod + normalisasi WA `+62`; email read-only (tidak diterima dari form). Preferensi WA hanya default centang di checkout (OD-19). Audit `donor.profile_updated` tanpa nilai PII.
- **Risiko diterima (belum diubah, menunggu PM):**
  - L2: teks doa (`prayer`) tetap disimpan saat akun dihapus — keputusan retensi menunggu PM.
  - L3: checkout tamu dengan email orang lain menambah transaksi (pending) ke dashboard pemilik email — gangguan saja; tidak ada akses ke data pemilik.
  - L5: alamat email yang didaur ulang penyedia (pemilik baru Google) akan mengklaim transaksi tamu lama ber-email itu; klaim hanya mengandalkan email terverifikasi Google.


### Implementasi P21 (admin campaign, berita, penyaluran, upload)
- **Otorisasi:** setiap halaman/server action memanggil `requireAdmin(permission BR-40)` (`src/server/actions/admin-campaign-actions.ts`); service (`admin-campaign-service.ts`) memeriksa ulang permission (`AdminForbiddenError`) sebagai pertahanan berlapis. Publish/pause/complete/arsip campaign = `campaigns.publish`; tulis/hapus draft = `campaigns.write`; editor (`campaigns.write`) boleh mengubah konten campaign tayang/dijeda (OD-20), tetapi `isFeatured` hanya diterima dari pemegang `campaigns.publish` (selain itu nilai lama dipertahankan) dan slug terkunci setelah campaign pernah terbit (`published_at` terisi); berita = `news.write`, terbit/tarik/ubah berita terbit/hapus berita terbit = `news.publish`; penyaluran = `disbursements.write`. Upload = `campaigns.write` atau `news.write`.
- **Validasi:** Zod (`src/lib/validation/admin-campaign.ts`) untuk semua input; nominal string digit → `bigint`, batas platform Rp1.000.000.000; slug unik + kata reserved. Mutasi + baris audit (diff, bigint → string) dalam satu DB transaction.
- **Sanitize-on-save:** `descriptionHtml` campaign & `contentHtml` berita disanitasi `sanitizeRichText` (whitelist yang sama dengan render P07) sebelum disimpan; render tetap menyanitasi ulang.
- **URL gambar:** service hanya menerima URL dari storage aplikasi (`isManagedImageUrl`: host store Blob **milik proyek ini** — kesamaan hostname persis, diturunkan dari `BLOB_STORE_ID` atau id store di token (`src/lib/storage/blob-host.ts`); store Blob lain ditolak — atau `/api/dev-uploads/*.webp` di development) atau URL yang sudah tersimpan — URL eksternal sembarang ditolak.
- **Upload (`POST /api/admin/images`):** sesi admin + permission, cek header Origin = origin kanonik `APP_URL` saja (tidak memercayai Host/X-Forwarded-Host; lapis kedua setelah cookie `SameSite=Strict`), `Content-Length` wajib & numerik (411), batas 2 MB + 16 KB overhead multipart ditegakkan pada **stream** (`readCapped` membatalkan pembacaan di atas batas, sebelum parsing multipart; 413), rate limit 30 upload/10 menit per admin (429), tipe dari **magic bytes** (JPEG/PNG/WebP; bukan ekstensi/Content-Type), re-encode WebP dengan sharp (rotate, lebar ≤ 1600, `limitInputPixels`, metadata EXIF/GPS dibuang), audit `image.upload`. Respons `no-store`.
- **Storage adapter:** Vercel Blob (utama; `BLOB_READ_WRITE_TOKEN` server-only, wajib di preview/production); adapter lokal hanya `APP_ENV=development` tanpa token; `/api/dev-uploads/[file]` → 404 di luar development, nama file divalidasi regex (tanpa path traversal), `nosniff`.
- **Aturan data:** paket dipakai transaksi tidak bisa dihapus (FK RESTRICT + cek); hapus permanen hanya draft tanpa transaksi (status & jumlah transaksi dicek ulang di dalam DB transaction dengan `FOR UPDATE`); arsip mencatat perubahan `isFeatured` di audit; berita & penyaluran soft delete; total penyaluran ≤ `collected_amount` dicek dengan `SELECT … FOR UPDATE` (BR-43); penyaluran hanya untuk campaign non-draft dan berita bukti wajib berstatus terbit, belum dihapus, milik campaign yang sama.
- **Pratinjau draft:** `getCampaignPreview` mensyaratkan slug **dan** `campaignId` dari token cocok; token HMAC-SHA256 (kunci turunan `AUTH_SECRET` + label domain), dibandingkan `timingSafeEqual`, kedaluwarsa 1 jam. Tautan pratinjau hanya dibuat untuk pemegang `campaigns.write`.
- **Risiko terbuka:** refund belum menurunkan `collected_amount` (alur refund belum dirancang — terkait temuan payment M1), sehingga batas penyaluran BR-43 bisa longgar setelah refund; blob yatim tidak dibersihkan; memo 404 proxy hanya dikosongkan di instance yang sama.
