# Kumpulan Prompt Gambar — Tebar Kebaikan Instagram

> Prompt dalam bahasa Inggris agar konsisten di Grok, Claude, Midjourney, atau generator lain. ID sama dengan yang dipakai di `profile.md`, `feed-posts.md`, `carousel-posts.md`.
>
> **Aturan untuk semua prompt:**
> - Gambar AI hanya ilustrasi/latar. Tidak boleh dipakai sebagai dokumentasi program nyata.
> - **Tidak ada logo/teks hasil AI.** Logo asli (`assets/brand-src/logo-icon.png`, `logo-wide.png`) dan semua teks headline ditempel manual di editor.
> - Tanpa wajah orang yang bisa dikenali, tanpa wajah anak, tanpa tokoh publik, tanpa logo bank/e-wallet/payment gateway atau merek lain.
> - Ruang kosong disediakan untuk teks sesuai safe area (`brand-guidelines.md` §8).

**Blok gaya bersama (tempel di akhir setiap prompt):**
`Style: warm, calm, premium flat illustration with soft gradients; brand palette deep green #086828, dark green #053F1E, decorative bright green #089838, warm orange #F89808, yellow #F8B808, cream background #FAF9F5, soft green tint #E6F4EA; very subtle thin-line eight-pointed star geometric pattern at 8–10% opacity; clean composition with generous empty space for text; no text, no letters, no logos.`

**Negative prompt bersama (`NEG-BASE`):**
`text, letters, words, typography, watermark, signature, logo, brand mark, bank logo, e-wallet logo, payment company logo, identifiable human face, children's faces, celebrities, public figures, crying, tears, wounds, blood, extreme poverty imagery, dirty, dark gloomy mood, heavy ornate calligraphy, arabic script, religious text, flags, distorted hands, extra fingers, low resolution, blurry, oversaturated neon colors, cluttered background`

| ID | Dipakai di | Rasio / ukuran |
|---|---|---|
| IG-PF-01 | profile.md §1 | 1:1 · 1080×1080 |
| IG-FD-01 … IG-FD-05 | feed-posts.md | 4:5 · 1080×1350 (IG-FD-04 1:1 · 1080×1080) |
| IG-CR-01-S1/S2/S3/S4/S6 | carousel-posts.md | 4:5 · 1080×1350 |
| IG-CR-02-S1/S3/S6 | carousel-posts.md | 4:5 · 1080×1350 |
| IG-CR-03-S1/S5 | carousel-posts.md | 4:5 · 1080×1350 |
| IG-CR-04-S1 | carousel-posts.md (opsional) | 4:5 · 1080×1350 |
| IG-CR-05-S1/S4 | carousel-posts.md | 4:5 · 1080×1350 |

---

## Profil

### IG-PF-01 — Latar foto profil
- **Rasio:** 1:1, 1080×1080
- **Prompt:** Square background, warm cream color #FAF9F5, very subtle thin-line eight-pointed star geometric pattern in green #086828 at 8% opacity only near the outer edges, clean empty circular center area for placing a logo, soft even lighting, flat minimal, no text.
- **Negative:** `NEG-BASE`, busy center, objects in the middle, dark background
- **Catatan:** utamakan file logo asli di atas latar krem polos; prompt ini opsional.

## Feed

### IG-FD-01 — Perkenalan
- **Rasio:** 4:5, 1080×1350
- **Prompt:** Two stylized open hands in deep green #086828 gently cupping a glowing warm heart-shaped light in yellow #F8B808 to orange #F89808 gradient, a soft flowing orange wave beneath, cream background #FAF9F5, faint eight-pointed star line pattern in the corners, empty upper third for headline. + blok gaya
- **Negative:** `NEG-BASE`, realistic skin, mosque photo, dome shape identical to a logo

### IG-FD-02 — Program pilihan (cadangan ilustrasi)
- **Rasio:** 4:5, 1080×1350
- **Prompt:** Gentle illustration of a community act of giving: neatly packed aid boxes and a small stack of books on a wooden table in soft morning light, a hand from out of frame placing one more box, warm cream and green tones, empty lower 40% for a text panel. + blok gaya
- **Negative:** `NEG-BASE`, people's faces, brand labels on boxes
- **Catatan:** ganti dengan foto asli program bila ada; ilustrasi diberi label "Ilustrasi".

### IG-FD-03 — Hamba Allah
- **Rasio:** 4:5, 1080×1350
- **Prompt:** Dark green background #053F1E, a single hand seen from the side quietly slipping a softly glowing cream envelope into a simple unmarked wooden box, warm golden light from the envelope, subtle eight-pointed star line pattern at 8% opacity, calm and humble mood, empty space at top for headline. + blok gaya
- **Negative:** `NEG-BASE`, face, money bills, coins piles, donation box with writing

### IG-FD-04 — Kuitansi
- **Rasio:** 1:1, 1080×1080
- **Prompt:** Top-down flat lay of a blank generic receipt document with placeholder grey lines (no readable text), a small green check stamp #086828, a sprig of green leaves and a cup of tea on a cream surface #FAF9F5, soft shadow, tidy and trustworthy. + blok gaya
- **Negative:** `NEG-BASE`, readable numbers, real names, QR code, signature

### IG-FD-05 — Kategori program
- **Rasio:** 4:5, 1080×1350
- **Prompt:** Grid of eight simple thin-line icons in deep green #086828 on rounded cream cards: an open book, a heartbeat line, a hand holding a heart, a mosque dome, a small family of three silhouettes, a cloud with rain, a food package box, a small sparkle star; consistent stroke width, orange #F89808 small accent dot on each card, empty band at top for headline. + blok gaya
- **Negative:** `NEG-BASE`, flags, detailed faces, 3D clutter

## Carousel

### IG-CR-01-S1 — Cover "3 langkah"
- **Rasio:** 4:5
- **Prompt:** Dark green background #053F1E, a hand holding a modern smartphone with a blank glowing cream screen, three small orange #F89808 circular markers floating beside it, subtle eight-pointed star pattern, space at top for headline. + blok gaya
- **Negative:** `NEG-BASE`, phone brand logo, app icons, readable UI text

### IG-CR-01-S2 — Langkah 1
- **Rasio:** 4:5
- **Prompt:** Flat illustration of a smartphone screen with an abstract program card (image placeholder rectangle, green progress bar #086828, rounded buttons with no text) and a finger tapping a large orange #F89808 button, cream background. + blok gaya
- **Negative:** `NEG-BASE`, readable UI text, real app screenshots

### IG-CR-01-S3 — Langkah 2
- **Rasio:** 4:5
- **Prompt:** Flat illustration of a smartphone showing an abstract form: empty input fields, one toggle switch turned on in green #086828, and three generic payment option tiles shown only as simple icons (a QR square, a wallet, a bank building), cream background. + blok gaya
- **Negative:** `NEG-BASE`, bank logos, e-wallet logos, readable text

### IG-CR-01-S4 — Langkah 3
- **Rasio:** 4:5
- **Prompt:** Flat illustration of a smartphone displaying a generic abstract QR-like square pattern (not scannable) and a small hourglass icon in orange #F89808, a second hand holding another phone to scan it, cream background. + blok gaya
- **Negative:** `NEG-BASE`, real scannable QR code, payment brand marks

### IG-CR-01-S6 — Penutup
- **Rasio:** 4:5
- **Prompt:** Soft green tint background #E6F4EA, gentle glowing heart-shaped light in yellow-orange gradient at center, faint eight-pointed star line pattern, large empty area at bottom for logo and call to action. + blok gaya
- **Negative:** `NEG-BASE`

### IG-CR-02-S1 — Cover transparansi
- **Rasio:** 4:5
- **Prompt:** Cream background, a magnifying glass in deep green #086828 hovering over a simple abstract flow of three rounded nodes connected by a line (a heart, a jar filling with golden light, a package box), yellow #F8B808 highlights, empty top half for headline. + blok gaya
- **Negative:** `NEG-BASE`, charts with numbers, currency symbols

### IG-CR-02-S3 — Rincian penyaluran
- **Rasio:** 4:5
- **Prompt:** Flat illustration of a clean list card with four abstract rows, each row with a small green icon and grey placeholder bars (no readable text), a calendar icon and a small link icon, on a soft green background #E6F4EA. + blok gaya
- **Negative:** `NEG-BASE`, readable numbers, spreadsheet software UI

### IG-CR-02-S6 — Penutup transparansi
- **Rasio:** 4:5
- **Prompt:** Dark green background #053F1E, an open hand releasing small glowing golden particles that drift upward and form a faint eight-pointed star outline, calm and hopeful, empty center-bottom area for text. + blok gaya
- **Negative:** `NEG-BASE`

### IG-CR-03-S1 — Cover kuitansi
- **Rasio:** 4:5
- **Prompt:** Soft cream-gold background #FEF3DC, a blank generic document with a folded corner and a green check badge #086828 tucked into a simple folder, a few green leaves, top area empty for headline. + blok gaya
- **Negative:** `NEG-BASE`, readable text on document, official seals, government emblems

### IG-CR-03-S5 — Cara mendapatkan kuitansi
- **Rasio:** 4:5
- **Prompt:** Three simple line icons in a row on cream cards: an envelope with a small document, a download arrow over a document, a person-silhouette dashboard window; deep green #086828 strokes with orange #F89808 accents. + blok gaya
- **Negative:** `NEG-BASE`, email provider logos, Google logo

### IG-CR-04-S1 — Cover kabar program (opsional)
- **Rasio:** 4:5
- **Prompt:** Gentle illustration of a sunrise over a modest village landscape with a small community building and a path, viewed from distance, no people visible, warm orange #F89808 sky fading into cream, green #086828 hills, hopeful mood, empty top area for headline. + blok gaya
- **Negative:** `NEG-BASE`, people, recognizable real location, disaster destruction
- **Catatan:** beri label "Ilustrasi"; isi slide lain wajib foto dokumentasi asli berizin.

### IG-CR-05-S1 — Cover FAQ keamanan
- **Rasio:** 4:5
- **Prompt:** Cream background, a large friendly shield icon in deep green #086828 with a small padlock, beside a smartphone with a blank screen, two chat bubbles (cream and soft green #E6F4EA) with no text, orange #F89808 accent sparkle. + blok gaya
- **Negative:** `NEG-BASE`, security certification badges, bank logos, padlock with brand

### IG-CR-05-S4 — Batas waktu pembayaran
- **Rasio:** 4:5
- **Prompt:** Flat illustration of an hourglass in orange #F89808 next to a smartphone with an abstract countdown ring in green #086828 (no digits), cream background, calm not alarming. + blok gaya
- **Negative:** `NEG-BASE`, red alarm, panic, readable numbers
