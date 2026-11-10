import type { ComponentType } from 'react';
import HomePage from '@/public/HomePage';
import CampaignDetailPage from '@/public/CampaignDetailPage';
import NewsDetailPage from '@/public/NewsDetailPage';
import CheckoutFormPage from '@/public/CheckoutFormPage';
import SelectPaymentPage from '@/public/SelectPaymentPage';
import PaymentInstructionPage from '@/public/PaymentInstructionPage';
import { PaymentPendingPage, PaymentSuccessPage } from '@/public/PaymentResultPages';
import { DonorDashboardPage, DonorLoginPage, DonorProfilePage, DonorTransactionDetailPage, DonorTransactionsPage } from '@/donor/DonorPages';
import AdminDashboardPage from '@/admin/AdminDashboardPage';
import { AdminCampaignEditorPage, AdminCampaignsPage, AdminNewsPage } from '@/admin/CampaignAdminPages';
import { AdminDonorsPage, AdminPaymentLogsPage, AdminPaymentMethodsPage, AdminTransactionDetailPage, AdminTransactionsPage } from '@/admin/FinanceAdminPages';
import { AdminNotificationLogsPage, AdminTemplatesPage } from '@/admin/NotificationAdminPages';
import { AdminAuditPage, AdminLoginPage } from '@/admin/AdminMiscPages';

export type Group = 'Publik' | 'Donatur' | 'Admin';
export interface PageDef { id: string; group: Group; title: string; note: string; states: string; Component: ComponentType; device: 'mobile' | 'desktop' }

const P = (id: string, group: Group, title: string, note: string, Component: ComponentType, device: PageDef['device'] = 'mobile', states = 'loading · empty · error'): PageDef => ({ id, group, title, note, Component, device, states });

export const pages: PageDef[] = [
  P('home', 'Publik', 'Home Page', 'Hero, statistik kepercayaan, campaign mendesak, filter kategori', HomePage),
  P('campaign-detail', 'Publik', 'Campaign Detail', 'Galeri, progres, rincian dana, kabar, donatur, sticky CTA', () => <CampaignDetailPage />, 'mobile', 'loading · error'),
  P('campaign-detail-paused', 'Publik', 'Campaign Detail — Dijeda', 'CTA nonaktif dengan alasan (status paused)', () => <CampaignDetailPage status="paused" />, 'mobile', '—'),
  P('news-detail', 'Publik', 'News Detail', 'Kabar penyaluran + kartu campaign terkait', NewsDetailPage, 'mobile', 'loading · error'),
  P('checkout-open', 'Publik', 'Checkout Form — Open Amount', 'Saran nominal + input custom tervalidasi (min/max, 13 digit)', () => <CheckoutFormPage variant="open" />, 'mobile', 'loading (submit) · error'),
  P('checkout-fixed', 'Publik', 'Checkout Form — Fixed Amount', 'Paket nominal dari admin, donatur login (prefill)', () => <CheckoutFormPage variant="fixed" loggedIn />, 'mobile', 'loading · error'),
  P('select-payment', 'Publik', 'Select Payment', 'Metode dikelompokkan QRIS / E-Wallet / VA', SelectPaymentPage, 'mobile', 'loading · empty · error'),
  P('instruction-va', 'Publik', 'Payment Instruction — VA', 'Nomor VA, salin, countdown, langkah per kanal', () => <PaymentInstructionPage kind="va" />, 'mobile', 'error = kedaluwarsa'),
  P('instruction-qris', 'Publik', 'Payment Instruction — QRIS', 'QR (ilustratif), unduh QR, countdown', () => <PaymentInstructionPage kind="qris" />, 'mobile', 'error = kedaluwarsa'),
  P('instruction-ewallet', 'Publik', 'Payment Instruction — E-Wallet', 'Tombol buka aplikasi e-wallet', () => <PaymentInstructionPage kind="ewallet" />, 'mobile', 'error = kedaluwarsa'),
  P('payment-success', 'Publik', 'Payment Success', 'Terima kasih, ringkasan, kuitansi, ajakan login', () => <PaymentSuccessPage />, 'mobile', 'loading (verifikasi)'),
  P('payment-pending', 'Publik', 'Payment Pending', 'Menunggu konfirmasi + auto-cek status', PaymentPendingPage, 'mobile', 'error = gagal'),

  P('donor-login', 'Donatur', 'Login (Google SSO)', 'Login satu tombol, tanpa password', DonorLoginPage, 'desktop', 'loading · error'),
  P('donor-dashboard', 'Donatur', 'Donor Dashboard', 'Total, sukses, pending, donasi terbaru', DonorDashboardPage, 'desktop'),
  P('donor-transactions', 'Donatur', 'Transaction List', 'Filter status & tahun, paginasi', DonorTransactionsPage, 'desktop'),
  P('donor-transaction-detail', 'Donatur', 'Transaction Detail', 'Timeline status, unduh PDF transaksi & kuitansi', DonorTransactionDetailPage, 'desktop', 'loading · error (404)'),
  P('donor-profile', 'Donatur', 'Profil Donatur', 'Data diri & preferensi notifikasi', DonorProfilePage, 'desktop', 'loading · error'),

  P('admin-login', 'Admin', 'Admin Login', 'Email + password + TOTP, lockout', AdminLoginPage, 'desktop', 'loading · error'),
  P('admin-dashboard', 'Admin', 'Admin Dashboard', 'KPI, grafik harian, performa campaign, transaksi terbaru', AdminDashboardPage, 'desktop'),
  P('admin-campaigns', 'Admin', 'Campaign Management', 'Daftar campaign + filter status/kategori/tipe', AdminCampaignsPage, 'desktop'),
  P('admin-campaign-editor', 'Admin', 'Campaign Editor', 'Open/Fixed amount, target terpisah, gambar + alt, SEO, status', AdminCampaignEditorPage, 'desktop', 'loading · error (validasi)'),
  P('admin-news', 'Admin', 'News Management', 'Daftar berita + editor (draft/publish)', AdminNewsPage, 'desktop'),
  P('admin-payment-methods', 'Admin', 'Payment Method Management', 'Status provider, aktif/urutan, instruksi', AdminPaymentMethodsPage, 'desktop', 'loading · error (provider)'),
  P('admin-transactions', 'Admin', 'Transaction Management', 'Filter, cari, ekspor CSV', AdminTransactionsPage, 'desktop'),
  P('admin-transaction-detail', 'Admin', 'Transaction Detail', 'Percobaan bayar, event, notifikasi, cek status', AdminTransactionDetailPage, 'desktop', 'loading · error'),
  P('admin-donors', 'Admin', 'Donor Management', 'Daftar donatur + panel detail riwayat', AdminDonorsPage, 'desktop'),
  P('admin-templates', 'Admin', 'Notification Templates', 'Editor email/WA, variabel, pratinjau, kirim tes', AdminTemplatesPage, 'desktop', 'loading · error (variabel)'),
  P('admin-notification-logs', 'Admin', 'Notification Logs', 'Status kirim, respon provider, kirim ulang', AdminNotificationLogsPage, 'desktop'),
  P('admin-payment-logs', 'Admin', 'Payment Logs', 'Webhook & status check, detail payload ter-redaksi', AdminPaymentLogsPage, 'desktop'),
  P('admin-audit', 'Admin', 'Audit Log', 'Perubahan oleh admin & sistem', AdminAuditPage, 'desktop', 'empty'),
];
