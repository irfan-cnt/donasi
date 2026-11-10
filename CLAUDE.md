# CLAUDE.md — Tebar Kebaikan

Platform donasi & crowdfunding Islami. Next.js App Router + TypeScript + Tailwind/shadcn + Drizzle/Neon + Upstash + Midtrans (Core API; satu-satunya provider MVP — OD-03).

## Fase proyek saat ini
**Phase 2 — Development (disetujui 10 Nov 2026).** Perubahan `src/` diizinkan, mengikuti `docs/05-roadmap/implementation-order.md` dan `docs/05-roadmap/prompt-playbook.md`. Keputusan PM tercatat di `docs/open-decisions.md`.

## Sumber kebenaran (urutan prioritas)
1. `docs/02-product/scope.md` + `business-rules.md` (scope tetap)
2. `docs/02-product/functional-requirements.md` + `acceptance-criteria.md`
3. `docs/03-technical/*` (TRD, arsitektur, payment, security)
4. `docs/04-database/*` (ERD & schema)
5. `docs/05-roadmap/implementation-order.md`

Perubahan arsitektur/skema yang disetujui **wajib** didahului update dokumen terkait dan disebut di ringkasan kerja.

## Aturan tidak bisa ditawar
- Jangan menandai pembayaran `paid` selain dari webhook terverifikasi atau `getPaymentStatus()` provider (BR-18).
- Total campaign hanya bertambah pada transisi pertama ke `paid` di dalam DB transaction (BR-19).
- Uang = `bigint` rupiah. Jangan pakai `number` untuk nominal di server; jangan hitung nominal di client sebagai kebenaran.
- Jangan pernah mengekspos secret (`MIDTRANS_SERVER_KEY`, `GMAIL_APP_PASSWORD`, `FONNTE_TOKEN`, `AUTH_SECRET`, `DATABASE_URL`, `QSTASH_*`). Modul yang membacanya harus `import 'server-only'`.
- Setiap server action/route admin memanggil `requireAdmin(permission)`; setiap akses data donor memfilter `donorId` dari sesi.
- Validasi semua input server dengan Zod.
- Jangan commit `.env*`. Jangan memakai kredensial produksi saat development.
- Jangan menambah fitur di luar scope; tulis usulan di `docs/02-product/proposals/`.
- Jangan menyalin kode, logo, teks, atau aset Amalsholeh.com.

## Konvensi kode (Phase 2)
- Struktur: lihat `README.md#struktur-proyek`. Logika bisnis di `src/server/services`, akses DB di `src/server/repositories`.
- Nama file kebab-case; komponen PascalCase; TypeScript `strict`.
- UI teks Bahasa Indonesia; format `Intl.NumberFormat('id-ID')`, zona `Asia/Jakarta`.
- Commit: Conventional Commits (`feat(payments): ...`).

## Perintah (Phase 2)
`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:e2e` · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed`

Mockup: `cd design-mockups && npm install && npm run dev`

## Sebelum menyatakan selesai
typecheck + lint + test hijau, cek konsol browser & network, cek responsif 360/768/1280, review keamanan (docs/03-technical/security.md §9). Jangan mengabaikan test gagal.

## Laporan milestone (wajib di akhir setiap prompt playbook)
```
### Laporan P<nomor> — <judul>
1. Ringkasan: apa yang dibuat/diubah (≤5 poin)
2. File berubah: daftar path
3. Validasi: typecheck / lint / unit / integration / e2e → hasil + jumlah test
4. Cek manual: konsol browser, network, responsif 360/768/1280 (bila ada UI)
5. Keamanan: implikasi & mitigasi
6. Dokumen yang diperbarui
7. Commit: hash + pesan; status deploy preview Vercel + URL
8. Isu terbuka / asumsi / keputusan yang dibutuhkan PM
9. Prompt berikutnya yang disarankan
```
Jangan menandai selesai bila ada test gagal; laporkan sebagai blocker.

Prompt berurutan untuk Phase 2–3: `docs/05-roadmap/prompt-playbook.md`.

## Multi-agent
Lihat `AGENTS.md`.
