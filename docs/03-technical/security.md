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
