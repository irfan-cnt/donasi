# Technical Requirements Document — Tebar Kebaikan

| Item | Nilai |
|---|---|
| Versi | 0.1 (Draft Phase 1) |
| Referensi | ../02-product/PRD.md |

## 1. Ringkasan teknis

Aplikasi monolit modular **Next.js (App Router) + TypeScript** di Vercel, database **Neon PostgreSQL** via **Drizzle ORM**, **Upstash Redis** (cache, rate limit), **Upstash QStash** (job & jadwal), pembayaran **Midtrans Core API** (satu-satunya provider MVP, OD-03) di balik interface `PaymentProvider`, email **Nodemailer + Gmail SMTP**, WhatsApp **Fonnte**, PDF server-side **@react-pdf/renderer**, auth donor **Auth.js v5 (Google)**, auth admin terpisah (credential + TOTP).

## 2. Stack & versi target

| Lapisan | Pilihan | Versi target* |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Framework | Next.js App Router | 15.x/16.x stabil terbaru saat Phase 2 |
| UI | React, Tailwind CSS, shadcn/ui, Lucide | React 19, Tailwind 4 |
| Validasi | Zod | 3.x/4.x |
| ORM | Drizzle ORM + drizzle-kit | terbaru stabil |
| DB driver | `@neondatabase/serverless` (HTTP untuk query, WebSocket/Pool untuk transaksi) | |
| Auth donor | Auth.js v5 (`next-auth`) + `@auth/drizzle-adapter` | |
| Hash password admin | `@node-rs/argon2` (argon2id) | |
| 2FA | `otplib` (TOTP) | |
| Cache/rate limit | `@upstash/redis`, `@upstash/ratelimit` | |
| Jobs | `@upstash/qstash` (publish + `Receiver` verifikasi) | |
| Email | `nodemailer` | |
| PDF | `@react-pdf/renderer` (Node runtime) | |
| Rich text | TipTap (admin), sanitasi `sanitize-html` saat simpan | |
| Chart admin | Recharts (via shadcn charts) | |
| Test | Vitest, Playwright, Testing Library | |

\* Versi persis dikunci di `package.json` saat Development Step 1.

### Evaluasi solusi auth (keputusan)

| Opsi | Kelebihan | Kekurangan | Keputusan |
|---|---|---|---|
| **Auth.js v5** | Standar Next.js, Google provider siap, adapter Drizzle, sesi DB | Credential provider kurang ideal untuk admin (tanpa sesi DB) | **Dipilih untuk donor** |
| Better Auth | Fitur lengkap (2FA, org) | Ekosistem lebih baru, tambahan dependensi | Alternatif bila Auth.js bermasalah |
| Clerk | Cepat, UI siap | Vendor lock-in, biaya per MAU, data di pihak ketiga | Ditolak |
| Custom (admin) | Kontrol penuh sesi, lockout, TOTP, cookie terpisah | Harus ditulis & diuji sendiri | **Dipilih untuk admin** (lingkup kecil, ±300 LOC, mengikuti OWASP) |

Alasan pemisahan: domain risiko berbeda, cookie & lifetime berbeda, mencegah eskalasi donor → admin (BR-40, AC-10.3).

## 3. Modul

| Modul | Lokasi | Tanggung jawab |
|---|---|---|
| campaigns | `src/features/campaigns` | Query publik, aturan BR-01..04, admin CRUD |
| news | `src/features/news` | CRUD, sanitasi, publish |
| donations | `src/features/donations` | Checkout, validasi nominal, transaksi |
| payments | `src/lib/payments` + `src/features/payments` | Provider, webhook, state machine, rekonsiliasi |
| donors | `src/features/donors` | Profil, klaim, dashboard |
| notifications | `src/features/notifications` + `src/lib/email`, `src/lib/whatsapp` | Template, render, kirim, log |
| admin | `src/features/admin` | RBAC, audit, dashboard |
| pdf | `src/lib/pdf` | Dokumen transaksi & kuitansi |

Lapisan: **UI (RSC/Client) → Server Actions / Route Handlers → Services (logika bisnis) → Repositories (Drizzle) → DB**. UI tidak memanggil repository langsung.

## 4. Kontrak antarmuka utama

### Server actions (publik)
| Action | Input (Zod) | Output |
|---|---|---|
| `createDonation` | `{campaignSlug, amount?, amountOptionId?, donorName?, donorEmail, donorPhone?, isAnonymous, prayer?, whatsappOptIn, hp}` | `{transactionCode, accessToken}` |
| `createPayment` | `{transactionCode, accessToken, paymentMethodCode}` | `{redirect: instructionUrl}` |

### Route handlers
| Endpoint | Metode | Auth |
|---|---|---|
| `/api/webhooks/midtrans` | POST | Signature Midtrans |
| `/api/transactions/[code]/status` | GET | access token transaksi / sesi pemilik |
| `/api/jobs/*` (expire, reconcile, notify, campaign-scheduler) | POST | Signature QStash |
| `/api/donor/transactions/[code]/pdf?type=summary|receipt` | GET | Sesi donor + ownership (P19) |
| `/api/transactions/[code]/receipt?t=` | GET | Access token transaksi (tamu, P19) |
| `/api/admin/export/{transactions|donors}` | GET | Sesi admin + permission |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js |

## 5. Data
Lihat ../04-database/. Uang `bigint` rupiah; waktu `timestamptz` (UTC); ID UUIDv7; kode publik terpisah dari ID.

## 6. Non-fungsional
Lihat performance.md, security.md, ../02-product/non-functional-requirements.md.

## 7. Lingkungan
`development` (lokal + Neon branch dev + Midtrans sandbox), `preview` (Vercel preview per PR + Neon branch per PR), `production`. Detail: deployment.md.

## 8. Kriteria teknis siap rilis
Typecheck, lint, unit, integrasi DB, E2E Playwright (alur donasi sandbox), uji webhook duplikat, uji otorisasi, audit keamanan — semuanya hijau. Lihat ../05-roadmap/release-checklist.md.
