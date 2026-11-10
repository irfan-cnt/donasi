# Design System — Tebar Kebaikan

Arah: premium, hangat, terpercaya, Islami secara halus. Light theme utama. Implementasi referensi: `design-mockups/src/styles/globals.css` + `design-mockups/tailwind.config.js` (akan dipindah ke `src/app/globals.css` + tema shadcn/ui di Phase 2).

## Warna (token CSS, format RGB)

| Token | Hex | Penggunaan |
|---|---|---|
| `--bg` | #FAF9F5 | Latar halaman (krem hangat) |
| `--surface` | #FFFFFF | Kartu, input |
| `--muted` | #F3F1EB | Latar sekunder, chip |
| `--border` | #E5E2D9 | Garis & batas |
| `--ink` | #17201C | Teks utama |
| `--ink-soft` | #4A5550 | Teks paragraf |
| `--ink-faint` | #78827D | Teks keterangan (≥4.5:1 di atas putih untuk ≥14px) |
| `--primary` | #086828 | Hijau logo — CTA, progres, tautan, ring fokus (putih di atasnya 6.95:1) |
| `--primary-hover` | #085828 | Hover tombol primer (8.62:1) |
| `--primary-ink` | #053F1E | Latar gelap (hero, footer, sidebar admin), nominal penting |
| `--primary-soft` | #E6F4EA | Latar terpilih (primary di atasnya 6.12:1) |
| `--primary-bright` | #089838 | Dekoratif saja — **bukan** teks/tombol (3.78:1) |
| `--gold` | #A35200 | Oranye gelap aman-teks: label aksen di putih (5.58:1) / gold-soft (5.07:1) |
| `--gold-soft` | #FEF3DC | Latar chip aksen; teks terang di latar hijau tua |
| `--brand-orange` | #F89808 | Oranye logo — isian CTA hero, bar “tanpa target”; teks di atasnya **gelap** (`text-ink`, 7.53:1), jangan putih (2.21:1) |
| `--brand-yellow` | #F8B808 | Dekoratif / hover CTA oranye (ink 9.41:1) |
| `--success/warning/danger/info` | #168048 / #B46E0A / #BE2832 / #1E64B4 | Status |

Aturan: maksimal satu CTA primer per layar; emas hanya untuk aksen/hero, bukan aksi destruktif; status selalu teks + warna (tidak hanya warna).

Grafik admin: seri utama `--primary`, seri kedua `--brand-orange`. Warna yang sama di-hardcode di `src/lib/notifications/email-layout.ts` (EMAIL_BRAND), `src/lib/pdf/documents.tsx`, `THEME_COLOR` (`src/lib/site.ts`, manifest) — ubah bersamaan.



## Tipografi
- **Plus Jakarta Sans** (UI, 400–800) — karya desainer Indonesia, terbaca baik di layar kecil.
- **Fraunces** (display, 600–700) — hanya untuk judul emosional (hero, terima kasih).
- Skala: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36–48 (hero). Angka nominal memakai `tabular-nums`.

## Spasi, grid, breakpoint
- Basis 4 px; padding kartu 16–20 px; gutter mobile 16 px.
- Kontainer publik `max-w-6xl` (1152 px); alur donasi `max-w-2xl` (fokus).
- Breakpoint Tailwind: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. Publik mobile-first; admin sidebar tampil ≥`lg`, drawer di bawahnya.

## Radius & bayangan
- Radius: input/tombol 12 px (`rounded-xl`), kartu 18 px (`rounded-2xl`), chip penuh.
- Bayangan: `card` (halus), `lift` (hover/modal), `cta` (bar CTA bawah).

## Komponen (lihat `design-mockups/src/components`)
| Komponen | Varian / catatan |
|---|---|
| Button | primary, secondary, outline, ghost, danger, gold · sm/md/lg/icon · tinggi ≥44 px untuk aksi utama |
| Input / Textarea / Select | state invalid, helper text, FieldError dengan ikon |
| Switch, Checkbox, Segmented | `role=switch/tab`, label wajib |
| Card, CardHeader | |
| Badge | neutral/primary/success/warning/danger/info/gold, opsi `dot` |
| Progress | primary; emas untuk campaign tanpa target |
| Alert | info/success/warning/danger |
| Skeleton, ListSkeleton | shimmer |
| EmptyState, ErrorState | ikon dengan motif, aksi pemulihan |
| Stat | KPI kartu |
| Table, Pagination | scroll horizontal di dalam kartu, min-width 720 px |
| Dialog/Drawer | drawer menu admin mobile (shadcn Sheet di Phase 2) |
| Navigasi | PublicHeader, BottomNav (mobile), FlowLayout (alur donasi + indikator langkah + bar CTA bawah), DonorShell, AdminShell |
| Domain | CampaignCard (vertikal/horizontal), FundProgress, CategoryChips, DonorRow, CopyField, MethodMark, TrxStatusBadge |

## Elemen Islami
Motif bintang 8 sudut sebagai pola garis sangat tipis (opasitas 8–10%) di hero, footer, ikon empty state. Salam & doa singkat di momen emosional (sukses, dashboard). Tidak ada kaligrafi dekoratif atau ornamen berat.

## Aksesibilitas
Kontras AA, fokus terlihat (`outline 2px primary`), target sentuh ≥44 px, `aria-live` pada countdown/status, alt wajib untuk semua gambar campaign/news, `role=radiogroup` untuk pilihan nominal & metode.

## Copy
Bahasa Indonesia hangat & sapaan “kamu”, kalimat pendek, istilah konsisten: *program* (publik) = *campaign* (admin), *donasi*, *kuitansi*, *Hamba Allah*. Hindari klaim yang tidak bisa dibuktikan.
