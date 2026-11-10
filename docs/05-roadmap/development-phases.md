# Development Phases

## Phase 1 — Concepting (sekarang)
Output: dokumentasi `docs/01–05`, design system, mockup TSX, konfigurasi agent, README, `.env.example`. **Berhenti untuk persetujuan.**

## Phase 2 — Development
| Step | Isi | Milestone |
|---|---|---|
| 1 | Repository setup (Next.js, TS, Tailwind, shadcn, ESLint, Prettier, Drizzle, Neon, Upstash, QStash, env, GitHub, Vercel) | M1 |
| 2 | Database: skema, migrasi, constraint, indeks, seed | M1 |
| 3 | Authentication: Google OAuth donor, admin login, RBAC, protected routes, logout | M2 |
| 4 | Public website (9 langkah berurutan) | M3 |
| 5 | Payment integration (Midtrans Core API) | M4 |
| 6 | Notification integration | M5 |
| 7 | Donor dashboard | M6 |
| 8 | Admin panel | M7 |
| 9 | Cache & scheduled jobs | M8 |
| 10 | Testing | berkelanjutan, final di M8 |
| 11 | Validasi per milestone | setiap milestone |
| 12 | Git workflow (review → test → commit → push → verifikasi Vercel → catat progres) | setiap milestone |

Setiap milestone ditutup dengan laporan: fitur, hasil test, URL preview, isu terbuka.

## Phase 3 — Publishing & Marketing
Landing page brief + implementasi (Next.js, copy Bahasa Indonesia), paket Instagram (profil, 5 feed, 5 carousel, 1 Reels + voiceover ElevenLabs, kalender 14 hari). Dimulai setelah aplikasi disetujui untuk launch.

## Dependensi eksternal (mulai sekarang, paralel)
| Item | Pemilik | Lead time | Dibutuhkan di |
|---|---|---|---|
| Akun merchant Midtrans (legalitas yayasan, rekening) | Lembaga | 1–3 minggu | M4 production |
| Google Cloud OAuth consent screen (verifikasi domain) | Tim teknis | 1–7 hari | M2 production |
| Google Workspace / Gmail App Password | Lembaga | 1 hari | M5 |
| Nomor & paket Fonnte | Lembaga | 1 hari | M5 |
| Domain + DNS | Lembaga | 1 hari | M1 |
| Kebijakan privasi, S&K, izin PUB | Legal lembaga | variatif | Sebelum launch |
