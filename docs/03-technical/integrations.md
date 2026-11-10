# Integrations

| Integrasi | Tujuan | Auth | Env | Sandbox | Dokumen |
|---|---|---|---|---|---|
| Google OAuth | Login donor | OAuth 2.0 client | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Test users di OAuth consent screen | console.cloud.google.com |
| Midtrans | Pembayaran | Basic auth server key | `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`*, `MIDTRANS_IS_PRODUCTION` | Dashboard sandbox + simulator | docs.midtrans.com |
| ~~Xendit~~ | Ditunda (OD-03) | — | — | — | docs.xendit.co |
| Gmail SMTP | Email | App Password (2FA wajib di akun) | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM` | Akun Gmail dev terpisah | support.google.com |
| Fonnte | WhatsApp | Token device | `FONNTE_TOKEN` | Nomor dev | docs.fonnte.com |
| Neon | Database | Connection string | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Branch dev | neon.tech/docs |
| Upstash Redis | Cache/rate limit | REST token | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | DB dev terpisah | upstash.com/docs |
| Upstash QStash | Job | Token + signing keys | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Local dev server QStash CLI | upstash.com/docs/qstash |
| Vercel Blob | Gambar campaign/berita (OD-12) | Read-write token (server-only, `@vercel/blob` `put` akses publik) | `BLOB_READ_WRITE_TOKEN` — **wajib di preview/production** (validasi `src/lib/env.ts`); boleh kosong di `APP_ENV=development` → adapter lokal `public/uploads/dev` | Store terpisah / dev tanpa token | vercel.com/docs/storage/vercel-blob |

\* Client key Midtrans hanya diperlukan bila memakai Snap/kartu kredit di browser; Core API server-side tidak membutuhkannya di client.

## Kontrak webhook URL
- Midtrans Payment Notification URL: `https://{domain}/api/webhooks/midtrans`
- Preview deployment tidak menerima webhook produksi; gunakan URL dev/ngrok untuk sandbox.

## Kontrak job QStash (P14)
- Endpoint: `POST https://{APP_URL}/api/jobs/{expire-payments|cancel-stale|reconcile|campaign-scheduler}` — wajib header `Upstash-Signature` yang valid untuk URL kanonik `APP_URL + path` (semua environment; tanpa bypass). `APP_URL` deployment harus sama dengan tujuan schedule.
- Schedule dibuat/diperbarui dengan `pnpm qstash:schedules` (`--dry-run` untuk melihat rencana; `--force` untuk memindah host; `--yes` wajib di production). `APP_URL` wajib di preview/production. Cron QStash dalam UTC: expire `*/5`, cancel-stale `7 * * * *`, reconcile `0 18 * * *` (01:00 WIB), campaign-scheduler `*/15`.
- `/api/jobs/notify` (P16) menerima `payment.paid`, `payment.pending`, dan `admin.alert` (rekonsiliasi → email `EMAIL_ADMIN_ALERT`).
- Development tanpa QStash: endpoint tetap menolak request tanpa signature; publish (notifikasi/lanjutan/alert) di-log & dilewati. Uji lokal end-to-end memakai QStash CLI dev server (`npx @upstash/qstash-cli dev`) dengan signing key-nya di `.env.local`.

## Failure mode

| Integrasi down | Dampak | Penanganan |
|---|---|---|
| Midtrans | Pembayaran baru tidak bisa dibuat | Banner "Pembayaran sedang gangguan" di Select Payment, alert admin, transaksi tetap `created` dan bisa dilanjutkan nanti |
| Webhook terlambat | Status tertunda | Polling halaman + expiry/reconcile job |
| QStash | Job/notifikasi tertunda | Job idempoten, jadwal berikutnya mengejar; outbox `notification.pending` dikuras rekonsiliasi |
| Gmail | Email tertunda | Retry QStash, log failed |
| Fonnte | WA tertunda | Retry, tidak blokir |
| Redis | Cache/rate limit tidak tersedia | Fail-open untuk cache, **fail-closed** untuk rate limit checkout? → default fail-open dengan log (open decision) |
| Neon | Situs dinamis down | Halaman ISR tetap tersaji; checkout menampilkan maintenance |

## Vercel Blob (P21, OD-12)
- Interface `ImageStorage` (`src/lib/storage/image-storage.ts`, server-only). Pemilihan: token ada → `BlobImageStorage`; tanpa token di development → `LocalImageStorage` (`public/uploads/dev`, di-gitignore, disajikan `/api/dev-uploads/[file]`); selain itu error fail-fast. Test memakai fake in-memory (`setImageStorageForTests`).
- Key: `images/YYYY-MM/<uuid>.webp`, `addRandomSuffix: false`, cache 1 tahun. `images.remotePatterns` (next.config) hanya host store proyek ini (`BLOB_STORE_ID`/token, dibaca saat build); bila store tidak diketahui: wildcard `*.public.blob.vercel-storage.com` hanya di `APP_ENV=development`, selain itu tanpa remote host. Env `BLOB_STORE_ID` (opsional, diset di Vercel) memakukan host yang diizinkan.
- E2E dijalankan dengan `BLOB_READ_WRITE_TOKEN=` (kosong) agar tidak mengunggah ke store sungguhan.
- Belum ada pembersihan blob yatim (upload yang tidak jadi disimpan).
