# Tebar Kebaikan

> Nama kerja sementara. Platform donasi & crowdfunding Islami yang sederhana, cepat, transparan, dan aman.

**Status:** Phase 1 — Concepting (dokumentasi & mockup). Kode aplikasi produksi belum dibuat; dimulai setelah persetujuan.

## Ringkasan
- Donasi tanpa akun (guest) atau login Google.
- Dua varian nominal campaign: **Open Amount** dan **Fixed Amount**.
- Pembayaran QRIS, e-wallet, dan Virtual Account melalui **Midtrans Core API** (di balik abstraksi provider agar gateway lain bisa ditambah kelak).
- Notifikasi email (Gmail SMTP) & WhatsApp (Fonnte) berbasis template.
- Dashboard donatur (riwayat, PDF transaksi & kuitansi) dan panel admin lengkap.

## Tech stack
| Lapisan | Teknologi |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide |
| Backend | Server Actions, Route Handlers, Zod |
| Database | Neon PostgreSQL, Drizzle ORM |
| Cache & jobs | Upstash Redis, Upstash QStash |
| Auth | Auth.js v5 (Google) untuk donor; auth admin custom (argon2id + TOTP) |
| Payment | Midtrans (Core API) |
| Notifikasi | Nodemailer + Gmail SMTP, Fonnte |
| PDF | @react-pdf/renderer |
| Deploy | GitHub, Vercel, Neon, Upstash |
| Test | Vitest, Playwright |

## Arsitektur
Monolit modular Next.js di Vercel (`sin1`). Postgres sebagai sumber kebenaran finansial; Redis hanya cache/rate limit; QStash untuk job bertanda tangan (expiry, rekonsiliasi, notifikasi). Detail & diagram: [docs/03-technical/system-architecture.md](docs/03-technical/system-architecture.md).

## Struktur proyek
```
docs/               Dokumentasi Phase 1 (riset, PRD, TRD, ERD, roadmap)
design-mockups/     Mockup TSX yang bisa dijalankan (Vite + React + Tailwind)
.claude/agents/     Definisi agent spesialis
src/                (Phase 2) app/, components/, features/, lib/, server/, types/
drizzle/            (Phase 2) migrasi
tests/              (Phase 2) unit, integration, e2e
marketing/          (Phase 3)
```

## Setup (Phase 2 — rencana)
```bash
corepack enable && pnpm install
cp .env.example .env.local   # isi nilai sandbox
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Preview mockup (sekarang)
```bash
cd design-mockups
npm install
npm run dev      # buka http://localhost:5173
npm run build    # build statis ke design-mockups/dist
```

## Environment variables
Daftar lengkap di [.env.example](.env.example). Semua secret hanya di server; jangan gunakan prefix `NEXT_PUBLIC_` untuk secret. Jangan commit `.env*`.

## Perintah pengembangan (Phase 2)
| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Server dev |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Drizzle |
| `pnpm admin:create` | Buat admin owner pertama |

## Deployment
GitHub → CI (typecheck, lint, test, build, E2E) → Vercel Preview (Neon branch per PR) → merge `main` → migrasi → Vercel Production. Lihat [docs/03-technical/deployment.md](docs/03-technical/deployment.md).

## Testing
Strategi & matriks uji: [docs/05-roadmap/testing-plan.md](docs/05-roadmap/testing-plan.md).

## Dokumentasi
Indeks: [docs/README.md](docs/README.md).
