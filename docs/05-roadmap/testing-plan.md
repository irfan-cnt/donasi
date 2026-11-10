# Testing Plan

## Piramida
| Level | Tool | Cakupan | Target |
|---|---|---|---|
| Unit | Vitest | Validasi Zod, money helpers, state machine, template engine, mapping status provider, signature verify | ≥80% cabang di `src/server/services` & `src/lib/payments` |
| Integrasi | Vitest + Postgres nyata (Neon branch CI / Docker) | Repository, constraint, `applyVerifiedStatus` konkuren, klaim tamu, RBAC | Semua constraint finansial |
| E2E | Playwright | Alur pengguna lintas halaman, sandbox provider | Semua AC P0 |
| Non-fungsional | Lighthouse CI, axe, k6 | Performa, aksesibilitas, beban | NFR-01..04, 14, 18 |

## Matriks skenario utama
| # | Skenario | Level | AC |
|---|---|---|---|
| 1 | Donasi open amount (preset & custom) sampai instruksi | E2E | AC-04.1–2, AC-05.4 |
| 2 | Donasi fixed amount; manipulasi optionId/amount ditolak | E2E + integrasi | AC-04.3–5 |
| 3 | Nominal ekstrem: 13+ digit, huruf, negatif, < min, > max | Unit + E2E | AC-04.1–2 |
| 4 | Payment pending → webhook paid (simulator Midtrans) → success | E2E sandbox | AC-06.4, AC-17.2 |
| 5 | Semua metode Midtrans aktif (QRIS, GoPay, ShopeePay, VA, Mandiri Bill) via simulator | E2E sandbox | AC-16.1 |
| 6 | Webhook duplikat 5× paralel → total +1, notifikasi 1× | Integrasi | AC-17.2, BR-32 |
| 7 | Signature salah → 401 | Integrasi | AC-17.1 |
| 8 | Nominal webhook berbeda → amount_mismatch | Integrasi | AC-17.4 |
| 9 | Expired via job (provider status expired) | Integrasi | AC-18.1 |
| 10 | Rekonsiliasi: paid di provider, pending di DB | Integrasi | AC-18.2 |
| 11 | Redirect `?status=paid` tidak mengubah status | E2E | AC-07.1 |
| 12 | Login Google (mock OAuth di E2E, manual di staging) | E2E | AC-09.x |
| 13 | Klaim transaksi tamu | Integrasi | AC-11.x |
| 14 | IDOR transaksi & PDF donor lain | E2E | AC-13.1, AC-14.2 |
| 15 | Admin role editor akses transaksi → 403 | E2E | AC-22.2 |
| 16 | Lockout admin | Integrasi | AC-22.1 |
| 17 | PDF kuitansi isi & header no-store | Integrasi | AC-14.x |
| 18 | Email terkirim (Gmail dev / Mailpit lokal) | Integrasi | AC-19.1 |
| 19 | WhatsApp tanpa opt-in tidak dikirim | Unit | AC-19.2 |
| 20 | Template variabel tak dikenal ditolak | Unit | AC-20.1 |
| 21 | Responsif 360/768/1280 tanpa overflow | E2E visual | NFR-16 |
| 22 | Konsol browser tanpa error di semua halaman E2E | E2E fixture | — |

## Data & lingkungan uji
- Seed sintetis deterministik; tidak memakai data produksi.
- Provider: sandbox Midtrans; adapter `FakeProvider` **hanya** untuk unit/integrasi, tidak terdaftar di build produksi.
- Email lokal: Mailpit; WhatsApp: mock HTTP (msw) di CI, nomor dev untuk uji manual.

## Kebijakan
- Test gagal = blocker merge; tidak boleh `skip` tanpa issue + persetujuan.
- Flaky test dikarantina maksimal 3 hari.
- Setiap bug produksi menambah test regresi.
