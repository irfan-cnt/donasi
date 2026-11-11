# Review Keamanan P25 — 11 November 2026

Cakupan: seluruh `src/` pada HEAD `e7e737a` (review read-only oleh agent security-reviewer), lalu hardening & perbaikan oleh implementer P25 (belum di-commit). Uji hanya terhadap server lokal `:3100` dan Neon branch `dev`; tidak ada uji ke Preview/Production, Midtrans, atau pihak ketiga.

**Hasil:** 0 Critical, 0 High, 5 Medium, 11 Low, 6 Info. **Semua Medium tertutup** (M1 & M2 dengan keputusan PM 11 Nov 2026). Low: 9 diperbaiki, 1 sebagian (L5 — satu sub-poin menunggu PM, OD-32), 1 usulan terbuka (L4). Risiko keseluruhan setelah perbaikan: **Rendah**.

## Ringkasan temuan

| ID | Severity | Judul | Status akhir |
|---|---|---|---|
| M1 | Medium | Refund tidak mengurangi total campaign | **Fixed** (OD-28) |
| M2 | Medium | TOTP hanya wajib untuk owner | **Fixed** (OD-29) |
| M3 | Medium | Kode TOTP bisa di-replay | **Fixed** |
| M4 | Medium | Pencarian global membocorkan email tanpa masking | **Fixed** |
| M5 | Medium | nodemailer 7.x (5 high) | **Fixed** (10.5.0) |
| L1 | Low | Arsip campaign menyimpang dari BR-01 | **Fixed** (OD-30) |
| L2 | Low | Halaman 403 admin berstatus HTTP 200 | **Fixed** (proxy 403) |
| L3 | Low | Body job ekspor QStash memuat kata kunci | **Fixed** |
| L4 | Low | Gambar Blob yatim tidak pernah dihapus | **Open** — usulan di bawah (owner: PM/tech lead) |
| L5 | Low | Checkout tamu: relay spam & transaksi "ditanam" | **Fixed sebagian** (OD-31); penautan ke akun terdaftar **Open** (OD-32, owner: PM) |
| L6 | Low | Tanpa rate limit buat/ganti metode bayar | **Fixed** |
| L7 | Low | Sisa data setelah hapus akun | **Fixed** (yang diwajibkan dokumen); doa **Open** (OD-33, owner: PM) |
| L8 | Low | `APP_ENV` diam-diam default `development` | **Fixed** |
| L9 | Low | Rotasi sesi setelah TOTP & lockout non-atomik | **Fixed** (DoS lockout tertarget: **Accepted**) |
| L10 | Low | `shadcn` di dependencies produksi; zod transitif | **Fixed** |
| L11 | Low | `String(error)` di log | **Fixed** |
| I1 | Info | Turunan IP tersebar & percaya XFF | **Fixed** |
| I2 | Info | Header keamanan/Referrer-Policy | **Fixed** (fase 1) |
| I3 | Info | Auth.js `trustHost: true` | Catatan (aman di Vercel) |
| I4 | Info | `/api/admin/images` redirect 307 | **Fixed** |
| I5 | Info | Doa tampil publik tanpa moderasi | Catatan (risiko konten) |
| I6 | Info | vitest menjalankan integration | Catatan |

## Detail per temuan

### M1 — Refund tidak mengurangi total (Medium) — Fixed
- **Lokasi:** `src/lib/payments/apply-verified-status.ts:321` (cabang refund baru), `src/lib/payments/midtrans/mapping.ts` (`partial_refund` → `partialRefund`), `drizzle/0003_p25_hardening.sql` (CHECK `donor_count >= 0`).
- **Skenario:** Finance menjalankan "Cek status" pada transaksi yang sudah di-refund di Midtrans; status jadi `refunded` tetapi progres publik & batas penyaluran (BR-43) tetap memuat uang tersebut.
- **Perbaikan (OD-28):** transisi pertama `paid → refunded` (refund penuh, hanya `source=admin_check`) menjalankan `UPDATE transactions … WHERE status='paid' RETURNING` lalu `collected_amount -= amount`, `donor_count -= 1`, audit `campaign.total_reversed` di DB transaction yang sama (baris payment `FOR UPDATE` → paralel = satu pengurangan). CHECK `>= 0` mencegah negatif (rollback). `partial_refund` tidak ditebak: `ignored_transition` + audit `payment.needs_review`.
- **Uji:** `tests/integration/apply-verified-status.test.ts` (3 refund paralel → 1 pengurangan + 1 audit; paid ulang tidak menambah; partial → tetap), `tests/unit/midtrans.test.ts`.
- **Dokumen:** BR-19/BR-20/BR-43, payment-architecture §5/§5a, schema.md, constraints.md, OD-28.

### M2 — TOTP hanya untuk owner (Medium) — Fixed
- **Lokasi:** `src/lib/admin-auth/index.ts:104`.
- **Skenario:** password `finance` bocor → satu faktor membuka ekspor PII donatur & metode pembayaran.
- **Perbaikan (OD-29):** `pendingStep = "totp-setup"` untuk setiap admin tanpa TOTP aktif (semua role); admin lama dipaksa setup saat login berikutnya (baris admin nyata PM tidak diubah langsung). Pesan `scripts/admin-create.ts` diperbarui; `admin-reset-password.ts` juga mengosongkan `totp_last_step`. Helper e2e `seedAdmin` default `totpEnabled: true`.
- **Uji:** `tests/e2e/admin-auth.spec.ts` ("role non-owner tanpa TOTP dipaksa setup TOTP").

### M3 — Replay TOTP (Medium) — Fixed
- **Lokasi:** `src/lib/security/totp.ts` (`verifyTotpStep`), `src/server/repositories/admin-repository.ts` (`claimTotpStep`), `src/server/services/admin-auth-service.ts:90` dan `confirmTotpSetup`.
- **Skenario:** kode yang tertangkap (shoulder-surfing/relay) dipakai ulang dalam ±90 detik.
- **Perbaikan:** kolom `admin_users.totp_last_step` (migrasi 0003); langkah yang cocok diklaim atomik `UPDATE … WHERE totp_last_step IS NULL OR totp_last_step < $step RETURNING` — gagal = login gagal (`reason: totp_replay`, dihitung ke lockout). Berlaku juga pada konfirmasi setup (kode setup tidak bisa dipakai untuk login).
- **Uji:** `tests/integration/admin-auth-hardening.test.ts` (replay ditolak, 3 login paralel dengan kode sama → 1 sukses, kode setup tidak bisa login), e2e setup→login.

### M4 — Pencarian global tanpa masking (Medium) — Fixed
- **Lokasi:** `src/server/services/admin-dashboard-service.ts:85`, `src/server/repositories/admin-dashboard-repository.ts` (`searchDonorsByEmail(q, { exact })`).
- **Skenario:** role `admin` (donors.read tanpa donors.export) mengetik `a@`, `b@`, … untuk mengenumerasi email donatur penuh.
- **Perbaikan:** tanpa `donors.export` → hanya cocok persis (`email = $q`) dan email dimasking `maskEmail` (konsisten dengan P22).
- **Uji:** `tests/integration/admin-dashboard.test.ts` ("P25 M4").

### M5 — nodemailer (Medium) — Fixed
- **Perbaikan:** `nodemailer` 7.0.13 → **10.5.0**, `@types/nodemailer` 8.0.2 (import `type Transporter` di `src/lib/email/gmail.ts`). Changelog 8–10 diperiksa: `NoAuth`→`ENOAUTH` (tidak dipakai), verifikasi TLS fetch remote (tidak dipakai), Node ≥ 20 (Vercel 22/24).
- **Uji:** `tests/unit/gmail-transport.test.ts` — jalur kirim `gmail.ts` dengan transport palsu (streamTransport): opsi SMTP 465/TLS, lampiran, injeksi header `Bcc` lewat subjek gagal, password tidak ada di pesan. **Tidak ada email nyata dikirim**; uji kirim sandbox nyata belum dilakukan.

### L1 — Arsip vs BR-01 (Low) — Fixed (OD-30)
- **Lokasi:** `src/lib/campaign-rules.ts:19` (`draft:["published"]`, `published/paused` tanpa `archived`), `src/components/admin/campaign-editor.tsx` (tombol arsip hanya bila `completed`), pesan service "selesaikan lalu arsipkan". Update status kini memakai guard `WHERE status = <status lama>` (race).
- **Konsistensi:** OD-18 (transaksi tetap boleh dibayar setelah campaign selesai) tetap berlaku; OD-19/20 tidak terdampak; tidak ada fixture `archived` di seed/e2e.
- **Uji:** `tests/unit/admin-campaign.test.ts`, `tests/integration/admin-campaign.test.ts`.

### L2 — 403 berstatus 200 (Low) — Fixed
- **Verifikasi awal (server lokal):** editor → `GET /admin/transaksi` = **200** dengan UI "Akses ditolak" (forbidden() di dalam Suspense, shell PPR sudah ter-stream).
- **Perbaikan:** `src/proxy.ts:55` `adminPermissionGate` + `src/lib/admin-auth/page-permissions.ts` + query `adminSessionPermissions` (`src/server/queries/public-route-exists.ts`): sesi valid & permission kurang → rewrite ke `/akses-ditolak` (halaman memanggil `forbidden()` di luar Suspense → **HTTP 403**). Rewrite ke halaman prerender biasa ternyata mengabaikan status dari proxy (terverifikasi), sehingga target memakai `forbidden()`. Sesi tidak valid/langkah wajib → diteruskan ke halaman (redirect). Error DB → fail-open ke halaman (UI 403, status 200).
- **Uji:** e2e `admin-auth.spec.ts` (editor → 403, finance → 200), `tests/unit/admin-page-permissions.test.ts` (tabel = `requireAdmin(permission)` tiap halaman).

### L3 — Kata kunci di body QStash (Low) — Fixed
- **Lokasi:** `src/server/services/admin-export-service.ts:292`.
- **Perbaikan:** filter disimpan di Redis `tk:export-filters:{exportId}` (TTL 2 jam); body QStash hanya `{exportId, adminId, kind, masked}`. Job membaca filter dari server; hilang → `export.failed` (`filters_expired`). Body format lama (dengan `filters`) masih diterima untuk job yang sudah antre.
- **Uji:** `tests/integration/admin-finance.test.ts` (body tanpa filter/email, filter hilang → gagal).

### L4 — Gambar Blob yatim (Low) — Open (usulan)
Tidak diimplementasikan: aman hanya bila **semua** kolom yang memuat URL gambar diketahui dan dijaga ke depan (campaign featured, galeri, berita, logo metode pembayaran, serta kemungkinan pengaturan/OG di masa depan), dan tidak bisa diuji terhadap Blob nyata secara lokal. **Usulan:** tabel `uploaded_images(key, url, uploaded_by, created_at)` diisi saat upload; job mingguan (QStash, `createJobHandler`) dengan mode `dry-run` default yang (1) mengambil kandidat > 7 hari, (2) mengecek referensi di semua kolom URL gambar via satu view `image_references` (diuji meta-test terhadap skema), (3) menghapus via `@vercel/blob del` hanya yang tidak direferensikan, (4) audit setiap penghapusan. Risiko saat ini rendah (URL tak tertebak, konten sudah di-re-encode WebP). Owner: PM/tech lead.

### L5 — Checkout tamu (Low) — Fixed sebagian (OD-31)
- **Perbaikan:** kolom `transactions.checkout_authenticated` (migrasi 0003; diisi `donation-service.ts:249`); `notification-service.ts:364` — transaksi tamu hanya mendapat WA untuk `payment.paid` (consent OD-19 tetap); rate limit `checkout-phone` 5/jam (`donation-service.ts:214`); `neutraliseDonorName` membuang URL/domain dari `{{donor_name}}`. Email tidak berubah. Transaksi lama (sebelum migrasi) dianggap tamu (konservatif).
- **Open (OD-32):** transaksi tamu dengan email milik akun terdaftar tetap tampil di dashboard pemilik email — tidak diubah tanpa keputusan PM. Rekomendasi: sembunyikan sampai diklaim.
- **Uji:** `tests/integration/notify-whatsapp.test.ts` (tamu pending → skipped, paid → sent), `tests/integration/rate-limits.test.ts` (per nomor), `tests/integration/create-donation.test.ts`, `tests/unit/security-hardening.test.ts` (nama).

### L6 — Rate limit buat/ganti metode (Low) — Fixed
- **Lokasi:** `src/server/services/payment-service.ts:276`, `src/server/actions/payments.ts`.
- **Perbaikan:** `create-payment-trx` 10/jam per transaksi + `create-payment-ip` 30/jam per IP sebelum charge. **Fail-closed** di preview/production bila Redis gagal (setiap percobaan = charge Midtrans; konsisten dengan lock pembayaran), lanjut hanya di development. Didokumentasikan di security.md.
- **Uji:** `tests/integration/create-payment.test.ts` ("P25 L6"). Cabang fail-closed belum diuji otomatis (test berjalan dengan `APP_ENV=development`).

### L7 — Sisa data hapus akun (Low) — Fixed + Open
- **Perbaikan:** `donor-repository.ts:152` — `ip_hash`, `user_agent` → NULL; `notification_logs` transaksi donor: `recipient` → `dihapus@invalid`, payload/respons/error → NULL. `payment_events.payload` sudah teredaksi saat simpan (email/WA/nama dimasking) dan append-only — tidak diubah.
- **Open (OD-33):** doa (`prayer`) tetap disimpan dan tetap tampil publik (catatan PM sebelumnya: retensi di bawah OD-14 — tidak dibalik diam-diam). Rekomendasi: tetap simpan, sembunyikan dari daftar publik setelah akun dihapus.
- **Uji:** `tests/integration/donor-dashboard.test.ts`.

### L8 — APP_ENV default (Low) — Fixed
- **Lokasi:** `src/lib/env.ts:119`. `VERCEL_ENV` preview/production + `APP_ENV` kosong/`development` → validasi gagal. Lokal/test/CI/Lighthouse tidak punya `VERCEL_ENV` → tidak terdampak.
- **Perlu dicek PM:** env Vercel Preview harus berisi `APP_ENV=preview` (deployment.md); bila belum, build preview berikutnya gagal dengan pesan jelas. **Belum diverifikasi** (tidak ada akses Vercel dari sesi ini).
- **Uji:** `tests/unit/env.test.ts`.

### L9 — Sesi & lockout (Low) — Fixed / Accepted
- Rotasi sesi + cabut sesi lain setelah TOTP aktif (`admin-auth-actions.ts:125`); `failed_login_count` dinaikkan atomik (`incrementFailedLogin`). Uji: `admin-auth-hardening.test.ts` (4 salah paralel → hitungan 4; ke-5 → terkunci).
- **Accepted:** lockout 5×/15 menit per akun bisa dipakai DoS tertarget — disengaja (AC-22.1); mitigasi: rate limit per IP+email, pemberitahuan audit `admin.lockout`.

### L10 — Dependensi dev (Low) — Fixed
`shadcn` dipindah ke `devDependencies` (dipakai hanya saat build: `@import "shadcn/tailwind.css"`; Vercel memasang devDependencies saat build). Override sempit `"@vercel/cli-config>zod": "^4.6.7"` (`pnpm-workspace.yaml`) karena `@vercel/oidc` 3.x terbaru masih mem-pin zod 4.1.11.

### L11 — String(error) (Low) — Fixed
`src/lib/safe-error.ts` (`safeError`: nama + kode); semua pemanggilan log `String(error)` (15 file) diganti, plus logger Auth.js (`error.message` dihapus). Tidak ada `String(error)` tersisa di `src/` (grep).

### I1 — IP klien — Fixed
`src/lib/http/client-ip.ts` (`x-vercel-forwarded-for` → XFF pertama → `x-real-ip`, `isIP`); dipakai `getRequestMeta`, route status, webhook, PDF, dan action pembayaran. Uji: `security-hardening.test.ts`.

### I2 — Header (fase 1) — Fixed. I3, I5, I6 — catatan saja. I4 — Fixed (`requireAdminApi([...])`, uji 401/403 di `admin-image-upload.test.ts`).

## Tabel guard route & server action (setelah P25)

| Endpoint / action | Guard |
|---|---|
| `POST /api/webhooks/midtrans` | signature SHA512 + cross-check Get Status; batas 16 KB; limit tolak 20/menit/IP |
| `POST /api/jobs/*` (6 job) | signature QStash (`createJobHandler`/`createNotifyHandler`), fail-closed |
| `POST /api/admin/exports`, `GET …/download` | `requireAdminApi` + Origin + HMAC token (download) |
| `POST /api/admin/images` | `requireAdminApi([campaigns.write, news.write, payment_methods.write])` + Origin + 30/10 menit |
| `/api/auth/[...nextauth]` | Auth.js |
| `GET /api/dev-uploads/[file]` | hanya `APP_ENV=development` (kini tidak mungkin di Vercel, L8) |
| `GET /api/donor/transactions/[code]/pdf` | `requireDonor` + filter donorId + 20/menit |
| `GET /api/transactions/[code]/receipt`, `/status` | kode + access token (hash) + rate limit |
| `GET /api/health` | publik |
| `createDonationAction` | publik; Zod; honeypot; limit IP/email/**nomor WA** |
| `createPaymentAction` | access token + slug; **limit per transaksi & IP (fail-closed)**; lock Redis |
| `loadMoreCampaigns`, `signInWithGoogle`, `signOutDonor`, `loginAdmin`, `logoutAdmin` | publik (allowlist meta-test beralasan) |
| Donor actions | `requireDonor` + donorId sesi |
| Admin actions | `requireAdmin(permission)` per action |
| Halaman admin | proxy: cookie + **permission → 403**; layout `requireAdmin()`; halaman `requireAdmin(permission)` |

Diverifikasi otomatis oleh `tests/unit/guard-coverage.test.ts` (setiap export action/route) dan `tests/unit/admin-page-permissions.test.ts`.

## Dependensi (`pnpm audit --prod`)

| Paket | Sebelum | Sesudah |
|---|---|---|
| nodemailer | 7.0.13: 4 high, 13 moderate, 1 low | 10.5.0: 0 |
| zod (via `@vercel/blob>@vercel/oidc>@vercel/cli-config`) | 4.1.11: 1 high | override 4.6.7: 0 |
| minimatch (via `shadcn`) | 1 moderate | devDependency (keluar dari `--prod`) |
| deepmerge (via `shadcn`, tanpa patch) | 1 low | devDependency |
| **Total `--prod`** | **23 (5 high, 16 moderate, 2 low)** | **0** |

`pnpm audit` termasuk dev: 3 (2 moderate, 1 low) — semuanya alat dev (`shadcn`), tidak masuk runtime. CI: `pnpm audit --prod --audit-level high`.

## Ringkasan hardening fase 1 (T-45/T-48)
- **Header** (`src/lib/security/headers.ts`, `src/proxy.ts`, `next.config.ts`): CSP per permintaan untuk semua halaman (termasuk 404/403):
  `default-src 'self'; script-src 'self' 'nonce-…' 'sha256-7mu4H06fwDCjmnxxr/xNHyuQC6pLTHr4M2E4jXw5WZs='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://<store>.public.blob.vercel-storage.com; font-src 'self'; connect-src 'self'; frame-src 'self'; media-src 'self'; manifest-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; upgrade-insecure-requests`
  API: `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. Plus `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` (`no-referrer` di URL ber-token), `Permissions-Policy`, COOP, HSTS 1 tahun (production https saja), `serverActions.allowedOrigins` = host `APP_URL`.
  **Alasan tanpa `'strict-dynamic'`:** shell prerender `cacheComponents` memuat chunk tanpa nonce — `'strict-dynamic'` mematikan hidrasi semua halaman (terverifikasi di browser). Tanpa `'unsafe-inline'` untuk script; `'unsafe-eval'` hanya `next dev`; `style-src 'unsafe-inline'` karena atribut `style` SSR (OD-27). Uji: `tests/e2e/csp.spec.ts` (nol pelanggaran CSP di halaman publik, checkout, transaksi, admin—Recharts/TipTap/pratinjau email—dan donor).
- **Bundle secret check:** `pnpm check:bundle-secrets` (nama & nilai secret di `.next/static` + prerender; CI setelah build) — 0 temuan.
- **Guard meta-test:** `tests/unit/guard-coverage.test.ts`.
- **gitleaks:** `.github/workflows/gitleaks.yml` (8.30.1, SHA-256 dipin) + `.gitleaks.toml` (allowlist 2 fixture palsu per file+nilai). Pemindaian lokal 35 commit: tidak ada secret nyata.

## Keputusan PM
Diputuskan 11 Nov 2026: OD-28 (refund), OD-29 (TOTP semua role), OD-30 (arsip), OD-31 (WA tamu). Terbuka: OD-27 (bentuk CSP, HSTS includeSubDomains/preload), OD-32 (transaksi tamu di akun terdaftar), OD-33 (doa setelah hapus akun), L4 (pembersihan Blob).
