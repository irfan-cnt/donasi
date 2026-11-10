# AGENTS.md — Tim Agent Tebar Kebaikan

Delapan agent spesialis di `.claude/agents/`. Agent utama (orchestrator) membagi tugas sesuai `docs/05-roadmap/implementation-order.md`, lalu meminta **qa-engineer** dan **security-reviewer** memvalidasi sebelum milestone ditutup.

| Agent | Tanggung jawab | Boleh mengubah | Bergantung pada | Menghasilkan |
|---|---|---|---|---|
| product-analyst | PRD, user story, AC, business rules, usulan scope | `docs/01-research`, `docs/02-product` | Input PM | Spesifikasi yang bisa diuji |
| ui-ux-designer | Design system, mockup, state UI | `design-mockups/`, `docs/06-design` | product-analyst | Mockup TSX, token desain |
| frontend-developer | Halaman & komponen Next.js, aksesibilitas, SEO | `src/app`, `src/components`, `src/features/*/ui` | ui-ux-designer, backend-developer (kontrak) | UI produksi |
| backend-developer | Server actions, services, route handlers, auth, notifikasi, PDF, jobs | `src/server`, `src/lib` (kecuali payments, db), `src/app/api` (kecuali webhooks) | database-engineer | Logika bisnis |
| database-engineer | Skema Drizzle, migrasi, indeks, seed, query performa | `src/lib/db`, `drizzle/`, `docs/04-database` | product-analyst | Skema & migrasi |
| payment-engineer | Abstraksi provider, adapter Midtrans Core API, webhook, rekonsiliasi | `src/lib/payments`, `src/app/api/webhooks`, `src/app/api/jobs/{expire,reconcile}` | database-engineer, backend-developer | Pembayaran andal |
| qa-engineer | Rencana uji, Vitest, Playwright, regresi | `tests/`, `*.test.ts`, `playwright.config.ts` | Semua | Laporan uji |
| security-reviewer | Review keamanan, threat model, dependensi | Read-only kode; boleh menulis `docs/03-technical/security.md` & laporan | Semua | Temuan + rekomendasi |

## Aturan koordinasi
1. Satu file dimiliki satu agent per tugas; perubahan lintas area melalui kontrak tipe di `src/types` yang disepakati.
2. Agent tidak mengubah dokumen yang disetujui tanpa menyebut perubahan dan alasannya.
3. Setiap tugas berakhir dengan: daftar file berubah, hasil typecheck/lint/test, risiko terbuka.
4. Temuan **security-reviewer** berlabel `blocker` harus ditutup sebelum merge.
5. Area finansial (payments, transactions, campaign totals) wajib direview payment-engineer **dan** security-reviewer.
6. Phase 1: hanya product-analyst, ui-ux-designer, database-engineer (dokumen) yang aktif.
