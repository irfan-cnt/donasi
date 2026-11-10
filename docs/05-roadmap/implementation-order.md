# Implementation Order

Tugas kecil & dapat diuji. `→` = dependensi. ★ = jalur kritis. Estimasi dalam hari kerja (d).

## M1 — Setup & Database
| ID | Tugas | Dep | Est | Agent |
|---|---|---|---|---|
| T-01 ★ | Init Next.js + TS strict + Tailwind + shadcn + ESLint/Prettier + struktur folder | — | 0.5d | frontend |
| T-02 | GitHub repo, branch protection, CI (typecheck, lint, test, build) | T-01 | 0.5d | backend |
| T-03 | Vercel project + env Preview/Production + Neon integration + Vercel Blob store (OD-12) + Sentry free tier (OD-13) | T-02 | 0.5d | backend |
| T-04 ★ | Drizzle config + skema identitas, campaign, news | T-01 | 1d | database |
| T-05 ★ | Skema transaksi, payment, events, receipt, notifikasi, audit, settings + constraint & indeks | T-04 | 1d | database |
| T-06 | Seed referensi + contoh, skrip `admin:create` | T-05 | 0.5d | database |
| T-07 | Upstash Redis + rate limit util; QStash publish + `verifySignature` util | T-01 | 0.5d | backend |
| T-08 | Util inti: `formatRupiah`, money (bigint) helpers, kode transaksi, UUIDv7, logger | T-01 | 0.5d | backend |
| T-50 | Skema `campaign_disbursements` + permission `disbursements.write` di seed (OD-06) | T-05 | 0.5d | database |

## M2 — Auth
| T-09 ★ | Auth.js v5 Google + Drizzle adapter + pembuatan donor | T-05 | 1d | backend |
| T-10 | `requireDonor()`, proteksi `/akun`, logout, callbackUrl aman | T-09 | 0.5d | backend |
| T-11 ★ | Admin auth: argon2id, sesi `admin_sessions`, lockout, TOTP | T-05 | 1.5d | backend |
| T-12 | RBAC `requireAdmin(permission)` + audit log helper | T-11 | 0.5d | backend |
| T-13 | Test otorisasi negatif (donor→admin, role salah) | T-10,T-12 | 0.5d | qa |

## M3 — Public website
| T-14 | Layout publik, header, bottom nav, footer, design tokens | T-01 | 1d | frontend |
| T-15 | Home: hero, kategori, daftar + ISR + cache | T-06,T-14 | 1d | frontend/backend |
| T-16 | Campaign listing `/campaign`: grid, filter kategori, "Muat lagi", completed terpisah, ISR (OD-07; tanpa pencarian) | T-15 | 1d | frontend |
| T-17 | Campaign Detail (+ donatur terbaru, berita, JSON-LD) | T-15 | 1.5d | frontend |
| T-18 | News Detail | T-17 | 0.5d | frontend |
| T-49 | Halaman legal: `/kebijakan-privasi`, `/syarat-ketentuan`, `/tentang`, `/kontak` + tautan footer/login/checkout (OD-08) | T-14 | 1d | frontend |
| T-52 | Komponen publik "Rincian Penyaluran Dana" di Campaign Detail (OD-06) | T-17,T-50 | 0.5d | frontend |
| T-19 ★ | Checkout Form + `createDonation` (Zod, BR-05..09, rate limit, access token) | T-17,T-07 | 1.5d | backend/frontend |
| T-20 ★ | Select Payment UI + daftar metode dari DB | T-19 | 1d | frontend |
| T-21 | Instruction, Success, Pending UI + endpoint status + polling | T-20 | 1.5d | frontend |

## M4 — Payments ★
| T-22 ★ | Interface `PaymentProvider`, registry, `applyVerifiedStatus()`, state machine + unit test | T-05 | 1.5d | payment |
| T-23 ★ | Adapter Midtrans (charge QRIS/VA/e-wallet, status, expire) | T-22 | 2d | payment |
| T-24 ★ | Webhook Midtrans + verifikasi + dedup + transaksi DB + total campaign | T-23 | 1.5d | payment |
| T-25 | `createPayment` action + ganti metode + fallback | T-23,T-20 | 1d | payment |
| ~~T-26~~ | ~~Adapter + webhook Xendit~~ — ditunda (OD-03, Midtrans-only) | — | 0d | — |
| T-27 | Test sandbox E2E Midtrans (paid, expired, duplikat, mismatch) | T-24 | 1d | qa |

## M5 — Notifications
| T-28 | Template engine + whitelist variabel + seed template | T-05 | 0.5d | backend |
| T-29 | Nodemailer Gmail + layout email | T-28 | 0.5d | backend |
| T-30 | Fonnte client + consent | T-28 | 0.5d | backend |
| T-31 | Job `/api/jobs/notify` (QStash, dedup, retry, log) + hook event dari payment | T-29,T-30,T-24 | 1d | backend |

## M6 — Donor dashboard
| T-32 | Klaim transaksi tamu saat login | T-09 | 0.5d | backend |
| T-33 | Dashboard ringkasan, riwayat, detail | T-32 | 1.5d | frontend |
| T-34 | PDF transaksi & kuitansi + nomor kuitansi | T-24 | 1.5d | backend |
| T-35 | Profil & preferensi notifikasi | T-33 | 0.5d | frontend |

## M7 — Admin
| T-36 | Layout admin + dashboard KPI & chart | T-12 | 1.5d | frontend |
| T-37 | Campaign list/editor + gambar (Vercel Blob) + amount config + SEO | T-12 | 2.5d | frontend/backend |
| T-38 | News list/editor (TipTap + sanitasi) | T-37 | 1d | frontend |
| T-51 | Admin penyaluran dana: tab di editor campaign, CRUD + validasi BR-43 + audit log + tautan berita bukti (OD-06) | T-37,T-38,T-50 | 1d | frontend/backend |
| T-39 | Payment method management + status provider | T-22 | 1d | frontend |
| T-40 | Transaksi list/detail/filter/export + cek status | T-24 | 1.5d | frontend/backend |
| T-41 | Donor list/detail/export | T-33 | 1d | frontend |
| T-42 | Template notifikasi (editor, preview, test send) + log | T-31 | 1.5d | frontend |
| T-43 | Payment logs/webhook events + audit log viewer | T-24 | 0.5d | frontend |

## M8 — Jobs & hardening
| T-44 ★ | Jobs: expire, cancel-stale, reconcile, campaign scheduler (QStash schedules) | T-24 | 1.5d | payment/backend |
| T-45 | Header keamanan, CSP, review secret bundle | semua | 0.5d | security |
| T-46 | Lighthouse CI, optimasi gambar, cache tuning | T-21 | 1d | frontend |
| T-47 | E2E penuh + responsif + regresi | semua | 2d | qa |
| T-48 | Security review penuh + perbaikan | semua | 1.5d | security |

**Jalur kritis:** T-01 → T-04 → T-05 → T-19/T-20 → T-22 → T-23 → T-24 → T-44 → T-47 → UAT (+ eksternal: verifikasi merchant).
