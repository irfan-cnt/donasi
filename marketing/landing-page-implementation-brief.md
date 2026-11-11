# Landing Page — Implementation Brief (P29 → input P30)

> Sumber copy: `marketing/landing-page-brief.md` (disingkat **LB §n**). Produk belum live; DB produksi kosong saat peluncuran → setiap section dinamis **wajib** punya state kosong yang layak. Komponen bertanda **(baru)** belum ada di repo; semua path lain sudah diverifikasi ada.
> Aturan: semua copy dari LB, tanpa lorem ipsum; tanpa angka tetap; uang `bigint` diformat `formatRupiah` (`src/lib/money.ts`); teks Bahasa Indonesia.

## 0. Keputusan route (perlu PM)

| Opsi | Konsekuensi |
|---|---|
| **A. `/` menggantikan home (rekomendasi)** | Satu halaman kuat untuk SEO; canonical `/` tetap; tidak ada konten duplikat. Home saat ini sudah memuat hero, statistik, program mendesak, daftar program, langkah — landing = **evolusi** home (tambah transparansi, kepercayaan, FAQ, CTA penutup). `tests/e2e/home.spec.ts` (satu H1, daftar program, filter kategori `?kategori=`, empty state, metadata/JSON-LD, overflow 360/768/1280) harus tetap hijau atau diperbarui di P30. Daftar program + filter kategori dipertahankan (ada test & tautan `basePath="/"`). |
| B. `/tentang-platform` | Home tak tersentuh, risiko regresi kecil; tetapi halaman baru bersaing dengan `/` untuk kata kunci yang sama, perlu canonical sendiri + entri `src/app/sitemap.ts`, dan trafik iklan/IG harus diarahkan ke URL yang kurang kuat. Tambah test e2e baru. |

Rekomendasi: **A**, karena konten landing sebagian besar sudah ada di `/` dan menghindari kanibalisasi. Bila PM memilih B, semua AC berlaku untuk `/tentang-platform` kecuali AC-02.

## 1. Struktur section (urut)

### S1. Hero
- **Tujuan:** pesan utama + CTA. **Copy:** LB §7 (alternatif terpilih PM), LB §8.
- **Komponen:** fungsi `Hero` di `src/app/(public)/page.tsx`; `buttonVariants` (`src/components/ui/button.tsx`); `FundProgress` (`src/components/public/fund-progress.tsx`); kelas `pattern-islamic`, token `bg-primary-ink`, `bg-brand-orange` (`src/app/globals.css`); `next/image` `priority` untuk kartu unggulan.
- **Data:** `getFeaturedCampaign()` (`src/server/queries/public-campaigns.ts`, `"use cache"` ISR 60 s + Redis `featured:v1` TTL 60 s).
- **State kosong:** tanpa program unggulan → kartu tidak dirender, CTA primer ke `/campaign` (perilaku saat ini). Mikrocopy "Tanpa wajib daftar · Kuitansi otomatis" tetap tampil.
- **Responsif:** 360 = satu kolom, CTA bertumpuk/wrap; 768+ = dua kolom (`md:grid-cols-2`); 1280 = `max-w-6xl`.
- **A11y:** satu-satunya `<h1>`; CTA tinggi ≥44 px (`h-11`); teks gelap di tombol oranye (kontras 7.53:1); ikon `aria-hidden`.

### S2. Statistik platform (TrustStrip)
- **Tujuan:** bukti dinamis. **Copy:** label "Terkumpul / Donasi / Laporan".
- **Komponen:** fungsi `TrustStrip` di `page.tsx`.
- **Data:** `getPlatformStats()` (`"use cache"`, revalidate 300 s) → `collectedAmount` (bigint), `paidDonations`, `publishedNews`.
- **State kosong (baru — wajib):** bila `paidDonations === 0`, **jangan** tampilkan "Rp0 / 0 / 0". Ganti dengan strip berisi tiga fakta produk statis: "Tanpa wajib daftar", "Kuitansi otomatis", "Rincian dana terbuka". Ambang tampil angka: `[ISI DATA: PM menentukan, mis. ≥1 donasi paid]`.
- **Responsif:** 3 kolom di semua lebar; angka `text-[13px]` di 360, `break-words` (sudah ada).
- **A11y:** `<dl>` dengan `aria-label="Statistik platform"` (ada).

### S3. Program mendesak + daftar program (showcase)
- **Copy:** LB §11. **Komponen:** `UrgentRow`, `ProgramList` di `page.tsx`; `CampaignCard`, `CampaignList`, `CampaignListSkeleton`, `CategoryChips`, `EmptyState` (`src/components/public/`).
- **Data:** `getUrgentCampaigns(3)`, `getPublicCategories()`, `getCampaignPage()` — semua cached (ISR 60 s, tag `campaigns`).
- **State:** loading = `CampaignListSkeleton` di `Suspense`; urgent kosong → section tidak dirender; daftar kosong → `EmptyState` "Program kebaikan baru segera hadir" (ada). Dilarang menampilkan program contoh/seed.
- **Responsif:** urgent = scroll horizontal snap di 360, grid 3 kolom ≥768 (ada).
- **A11y:** kartu = satu tautan dengan nama program; chip kategori bisa difokus keyboard.

### S4. Cara berdonasi (How It Works)
- **Copy:** LB §10 (5 langkah) — mengganti konstanta `STEPS`; kalimat "Semua program diverifikasi tim kami sebelum tayang." dipertahankan (keputusan PM 11 Nov 2026).
- **Komponen:** markup `<ol>` di `page.tsx` + ikon `lucide-react`. **Data:** statis.
- **Responsif:** 360 = daftar vertikal; 768 = 2 kolom; 1280 = 5 kolom atau 3+2.
- **A11y:** `<ol>` semantik; judul section `<h2>`.

### S5. Transparansi (baru)
- **Copy:** LB §13. **Komponen:** section **(baru)** `TransparencySection`; boleh memakai `Card` (`src/components/ui/card.tsx`). Ilustrasi rincian dana: render statis meniru `FundUsage` (`src/components/public/campaign-detail-view.tsx`) dengan label wajib "Contoh tampilan" — atau tautan ke program nyata setelah ada penyaluran.
- **Data:** statis. Kalimat biaya operasional bergantung OD-05 `[ISI DATA]`.
- **A11y:** ilustrasi diberi `aria-label`/teks alternatif yang menyebut "contoh".

### S6. Kepercayaan (baru)
- **Copy:** LB §9. **Komponen:** section **(baru)** `TrustSection`, ikon `ShieldCheck`, `FileText`, `BadgeCheck`.
- **Aturan:** blok legalitas **tidak dirender** sampai OD-02 terisi (feature flag konstanta di kode, bukan placeholder tampil). Tanpa logo pihak ketiga.

### S7. FAQ (baru)
- **Copy:** LB §14, 10 pertanyaan, teks identik. Butir berisi `[ISI DATA]` (no. 2 & 3) wajib diisi sebelum tayang; bila belum, butir itu dihapus dari halaman **dan** JSON-LD.
- **Komponen:** `<details>/<summary>` native (pola sama dengan `FundUsage`; tanpa JS tambahan). Tidak ada `accordion` di `src/components/ui`.
- **Data:** konstanta **(baru)** mis. `src/lib/landing-faq.ts` — satu sumber untuk UI dan JSON-LD.
- **A11y:** `summary` fokusable, judul FAQ `<h2>`, pertanyaan `<h3>` di dalam summary.

### S8. CTA penutup (baru)
- **Copy:** LB §8 "Pilih Program Kebaikan" → `/campaign`. Komponen: `buttonVariants`.

### S9. Footer
- **Komponen:** `Footer` (`src/components/public/footer.tsx`), dirender oleh `src/app/(public)/layout.tsx`. **Copy:** LB §15. Tautan halaman legal hanya ditambah bila halamannya ada (T-49). Kalimat "berizin Bank Indonesia" dipertahankan (keputusan PM 11 Nov 2026).

## 2. SEO
- `metadata` di `page.tsx`: title & description dari LB §17 (pilihan PM), `alternates.canonical`, `openGraph` (ada).
- **JSON-LD:** `organizationJsonLd()` (`src/lib/json-ld.ts`) via `JsonLd` (`src/components/public/json-ld.tsx`) — tambahkan `sameAs`/`contactPoint`/`legalName` hanya setelah `[ISI DATA]` terisi. **FAQPage (baru)**: fungsi `faqJsonLd()` di `src/lib/json-ld.ts`, dibangun dari konstanta FAQ yang sama dengan UI, serialisasi via `serializeJsonLd`.
- **OG image dinamis (baru):** `src/app/(public)/opengraph-image.tsx` (`next/og`), teks headline + logo, tanpa angka statistik (hindari cache "Rp0"). Saat ini memakai `DEFAULT_OG_IMAGE` (`src/lib/site.ts`).
- Indeksasi mengikuti `isIndexable()` (`src/lib/seo.ts`) — preview tetap noindex.

## 3. Tracking event

**Kondisi saat ini:** hanya **Vercel Speed Insights** (`src/components/shared/speed-insights.tsx`) — RUM performa, bukan event analytics. **Tidak ada** mekanisme event tracking di repo. CSP `connect-src 'self'` (`src/lib/security/headers.ts`).

**Spesifikasi event (untuk tooling yang dipilih PM):**

| Event | Pemicu | Properti |
|---|---|---|
| `landing_hero_cta_click` | klik CTA hero | `cta`: `primary`\|`secondary`, `target`: path |
| `landing_campaign_click` | klik kartu program di landing | `campaign_slug`, `section`: `featured`\|`urgent`\|`list`, `position` |
| `donation_start` | form donasi `/donasi/[slug]` dirender pertama kali | `campaign_slug`, `source`: `landing`\|`other` |

Tanpa PII (nama, email, WA, nominal, kode transaksi, query string).

**Keputusan PM (pilih satu):**
1. **Vercel Web Analytics** (`@vercel/analytics`, custom events) — same-origin `/_vercel/insights/*`, cocok CSP tanpa perubahan; tanpa cookie; custom events butuh paket Vercel berbayar `[VERIFIKASI: paket]`; tambah dependency kecil (JS bundle naik).
2. **Endpoint first-party (baru)** `POST /api/events` → log/Redis counter — CSP aman, nol pihak ketiga, tapi perlu dibangun + rate limit.
3. **GA4 / pihak ketiga** — butuh melonggarkan `script-src`/`connect-src`, banner persetujuan (UU PDP), beban JS → **tidak disarankan**.
Rekomendasi: opsi 1. Bila PM menunda, P30 mengimplementasikan helper `track()` **(baru)** no-op agar titik panggil sudah ada.

## 4. Target performa & aksesibilitas
- Lighthouse mobile: performa ≥90, aksesibilitas ≥95 (P30). Kendala diketahui (P24): JS framework ≈135 KB gzip; LCP Home ≈3 s lokal.
- Mitigasi: semua section baru = Server Component tanpa JS klien; FAQ native `<details>`; tidak ada carousel/animasi JS; hanya gambar hero `priority`; ikon via `lucide-react` tree-shaken; tracking dimuat setelah interaksi/idle.

## 5. Kriteria penerimaan

- **AC-01** Halaman memiliki tepat satu `<h1>` berisi headline terpilih dari LB §7.
- **AC-02** (Opsi A) `/` canonical ke `/`; semua test di `tests/e2e/home.spec.ts` lulus (atau diperbarui dengan alasan tertulis).
- **AC-03** Section tampil berurutan S1→S8, lalu footer.
- **AC-04** Tidak ada angka statistik/nominal tetap di source; semua angka dari query cached.
- **AC-05** Dengan DB tanpa donasi paid, strip statistik tidak menampilkan "Rp0" maupun "0"; tampil tiga fakta statis.
- **AC-06** Dengan DB tanpa program published, halaman tidak error, kartu unggulan & program mendesak tidak dirender, `EmptyState` tampil, CTA primer mengarah ke `/campaign`.
- **AC-07** FAQ menampilkan ≥8 pertanyaan; teks setiap Question/Answer di JSON-LD FAQPage identik dengan teks yang terlihat.
- **AC-08** Tidak ada string `[ISI DATA` atau `[VERIFIKASI` yang tampil di HTML produksi.
- **AC-09** Blok legalitas tidak dirender selama OD-02 belum terisi.
- **AC-10** JSON-LD Organization dan FAQPage valid (parse JSON sukses, `@type` benar).
- **AC-11** `og:image` mengarah ke gambar yang merespons 200 dengan tipe gambar.
- **AC-12** Tidak ada overflow horizontal di lebar 360, 768, 1280.
- **AC-13** Konsol browser tanpa error/peringatan CSP di halaman landing.
- **AC-14** Lighthouse mobile: performa ≥90, aksesibilitas ≥95 (atau deviasi dilaporkan dengan angka).
- **AC-15** Event `landing_hero_cta_click`, `landing_campaign_click`, `donation_start` terpanggil dengan properti sesuai §3 dan tanpa PII (diuji via helper `track()` yang di-mock).
- **AC-16** Semua CTA dan summary FAQ dapat dicapai dan diaktifkan dengan keyboard, fokus terlihat.
- **AC-17** *(diamandemen — keputusan PM 11 Nov 2026)* Copy halaman tidak memuat klaim "100% tersalurkan", "teraudit", testimoni, atau nama mitra. Tiga klaim yang dijamin PM **tetap dipakai apa adanya**: "Donasi dalam hitungan detik", "Semua program diverifikasi tim kami sebelum tayang", dan footer "payment gateway berizin Bank Indonesia".

## 6. Di luar scope
Testimoni; logo mitra/media/bank; halaman legal (T-49); donasi rutin, kalkulator zakat, qurban, aplikasi mobile, fundraiser (scope.md); A/B testing; chat widget; video hero; multi-bahasa; analytics pihak ketiga dengan cookie; perubahan alur checkout.
