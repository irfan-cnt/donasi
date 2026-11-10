# Indeks Mockup

Jalankan: `cd design-mockups && npm install && npm run dev` → buka `http://localhost:5173`. Indeks menampilkan semua layar; penampil (`#/v/<id>`) punya toolbar **state** (Normal/Loading/Empty/Error), **ukuran** (375/768/1280/penuh), dan navigasi sebelumnya/berikutnya. Build statis: `npm run build` (folder `dist/`), satu file: `npm run build:single` (`dist-single/index.html`).

| ID | Layar | Grup | File |
|---|---|---|---|
| home | Home Page | Publik | src/public/HomePage.tsx |
| campaign-detail, campaign-detail-paused | Campaign Detail (+ dijeda) | Publik | src/public/CampaignDetailPage.tsx |
| news-detail | News Detail | Publik | src/public/NewsDetailPage.tsx |
| checkout-open, checkout-fixed | Checkout Form (Open / Fixed) | Publik | src/public/CheckoutFormPage.tsx |
| select-payment | Select Payment | Publik | src/public/SelectPaymentPage.tsx |
| instruction-va / -qris / -ewallet | Payment Instruction | Publik | src/public/PaymentInstructionPage.tsx |
| payment-success | Success | Publik | src/public/PaymentResultPages.tsx |
| payment-pending | Pending (+ gagal di state error) | Publik | src/public/PaymentResultPages.tsx |
| donor-login | Login Google | Donatur | src/donor/DonorPages.tsx |
| donor-dashboard | Donor Dashboard | Donatur | 〃 |
| donor-transactions | Transaction List | Donatur | 〃 |
| donor-transaction-detail | Transaction Detail | Donatur | 〃 |
| donor-profile | Profil | Donatur | 〃 |
| admin-login | Admin Login (+TOTP) | Admin | src/admin/AdminMiscPages.tsx |
| admin-dashboard | Admin Dashboard | Admin | src/admin/AdminDashboardPage.tsx |
| admin-campaigns | Campaign Management | Admin | src/admin/CampaignAdminPages.tsx |
| admin-campaign-editor | Campaign Editor | Admin | 〃 |
| admin-news | News Management (+editor) | Admin | 〃 |
| admin-payment-methods | Payment Method Management | Admin | src/admin/FinanceAdminPages.tsx |
| admin-transactions | Transaction Management | Admin | 〃 |
| admin-transaction-detail | Transaction Detail | Admin | 〃 |
| admin-donors | Donor Management | Admin | 〃 |
| admin-payment-logs | Payment Logs | Admin | 〃 |
| admin-templates | Notification Templates | Admin | src/admin/NotificationAdminPages.tsx |
| admin-notification-logs | Notification Logs | Admin | 〃 |
| admin-audit | Audit Log | Admin | src/admin/AdminMiscPages.tsx |

Catatan: struktur master prompt (`public/ donor/ admin/ components/ styles/`) ada di dalam `design-mockups/src/` karena Vite memakai `design-mockups/public/` untuk aset statis.

## Hasil validasi (9 Nov 2026)
- `tsc --noEmit` ✅, `vite build` ✅ (JS 89,7 KB gzip, CSS 6,9 KB gzip)
- Playwright: 30 layar × 375/768/1280 px + 4 state di 375 px → **0 error konsol, 0 overflow horizontal**.
- Visual QA menemukan & memperbaiki: nomor VA terpotong di 375 px, kolom tanggal filter transaksi melebar, KPI nominal terpotong, layout template 3 kolom terlalu sempit di 1280 px.
- QR di instruksi QRIS adalah pola ilustratif, bukan QR yang dapat dipindai. Logo metode bayar adalah wordmark generik, bukan logo resmi.
