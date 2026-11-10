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

\* Client key Midtrans hanya diperlukan bila memakai Snap/kartu kredit di browser; Core API server-side tidak membutuhkannya di client.

## Kontrak webhook URL
- Midtrans Payment Notification URL: `https://{domain}/api/webhooks/midtrans`
- Preview deployment tidak menerima webhook produksi; gunakan URL dev/ngrok untuk sandbox.

## Failure mode

| Integrasi down | Dampak | Penanganan |
|---|---|---|
| Midtrans | Pembayaran baru tidak bisa dibuat | Banner "Pembayaran sedang gangguan" di Select Payment, alert admin, transaksi tetap `created` dan bisa dilanjutkan nanti |
| Webhook terlambat | Status tertunda | Polling halaman + expiry/reconcile job |
| Gmail | Email tertunda | Retry QStash, log failed |
| Fonnte | WA tertunda | Retry, tidak blokir |
| Redis | Cache/rate limit tidak tersedia | Fail-open untuk cache, **fail-closed** untuk rate limit checkout? → default fail-open dengan log (open decision) |
| Neon | Situs dinamis down | Halaman ISR tetap tersaji; checkout menampilkan maintenance |
