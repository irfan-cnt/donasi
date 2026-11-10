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

## 3. Otorisasi
- Fungsi `requireDonor()`, `requireAdmin(permission)` dipanggil di **setiap** server action, route handler, dan halaman server. Middleware hanya lapisan pertama.
- Query donor selalu memfilter `donor_id` dari sesi.
- Akses transaksi publik (instruksi/pending/success) memakai `access_token` 32 byte acak (hash disimpan di DB), dikirim di URL path/query hanya untuk pemilik; berlaku 7 hari; tidak pernah dicatat di log/analytics (redaksi).

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
