// Data contoh fiktif untuk mockup. Tidak terhubung ke database atau payment gateway.
import type { LucideIcon } from 'lucide-react';
import { BookOpen, HeartPulse, HandHeart, Landmark, Baby, CloudRain, Globe2, Sparkles } from 'lucide-react';

export type CampaignStatus = 'draft' | 'published' | 'paused' | 'completed' | 'archived';
export type AmountType = 'open' | 'fixed';
export type TrxStatus = 'created' | 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'refunded';

export interface Category { slug: string; name: string; icon: LucideIcon }
export const categories: Category[] = [
  { slug: 'pendidikan', name: 'Pendidikan', icon: BookOpen },
  { slug: 'kesehatan', name: 'Kesehatan', icon: HeartPulse },
  { slug: 'yatim-dhuafa', name: 'Yatim & Dhuafa', icon: Baby },
  { slug: 'masjid', name: 'Masjid', icon: Landmark },
  { slug: 'bencana-alam', name: 'Bencana Alam', icon: CloudRain },
  { slug: 'kemanusiaan', name: 'Kemanusiaan', icon: HandHeart },
  { slug: 'palestina', name: 'Palestina', icon: Globe2 },
  { slug: 'lainnya', name: 'Lainnya', icon: Sparkles },
];

export interface AmountOption { id: string; label?: string; amount: number; description?: string; active: boolean }
export interface Campaign {
  id: string; slug: string; title: string; short: string; category: string;
  collected: number; target: number | null; donors: number; daysLeft: number | null;
  status: CampaignStatus; amountType: AmountType; min: number; max: number | null;
  suggested: number[]; packages: AmountOption[]; hue: number; featured?: boolean;
  disbursed: number; opsFee: number; bankFee: number;
}

export const campaigns: Campaign[] = [
  {
    id: 'c1', slug: 'sumur-bor-desa-oebelo', title: 'Sumur Bor untuk 300 Keluarga di Desa Oebelo, NTT',
    short: 'Warga berjalan 4 km setiap hari untuk air bersih. Satu sumur bor mengubah semuanya.',
    category: 'kemanusiaan', collected: 187_450_000, target: 250_000_000, donors: 2_314, daysLeft: 23,
    status: 'published', amountType: 'open', min: 10_000, max: 100_000_000,
    suggested: [25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000], packages: [], hue: 165, featured: true,
    disbursed: 95_000_000, opsFee: 9_372_500, bankFee: 412_000,
  },
  {
    id: 'c2', slug: 'paket-sekolah-anak-yatim', title: 'Paket Sekolah untuk 500 Anak Yatim Tahun Ajaran Baru',
    short: 'Tas, seragam, buku, dan alat tulis agar mereka berangkat sekolah dengan percaya diri.',
    category: 'pendidikan', collected: 64_200_000, target: 125_000_000, donors: 811, daysLeft: 41,
    status: 'published', amountType: 'fixed', min: 50_000, max: null, suggested: [], hue: 35, featured: true,
    packages: [
      { id: 'p1', label: 'Paket Alat Tulis', amount: 75_000, description: 'Buku tulis, pensil, penggaris untuk 1 anak', active: true },
      { id: 'p2', label: 'Paket Seragam', amount: 150_000, description: 'Satu stel seragam dan kaos kaki', active: true },
      { id: 'p3', label: 'Paket Lengkap', amount: 350_000, description: 'Tas, seragam, sepatu, dan alat tulis', active: true },
      { id: 'p4', label: 'Paket Satu Kelas', amount: 3_500_000, description: 'Paket lengkap untuk 10 anak', active: true },
    ],
    disbursed: 30_000_000, opsFee: 3_210_000, bankFee: 140_000,
  },
  {
    id: 'c3', slug: 'renovasi-masjid-al-ikhlas-sukabumi', title: 'Renovasi Atap Masjid Al-Ikhlas yang Bocor Saat Hujan',
    short: 'Jamaah shalat di bawah ember penampung air. Atap harus diganti sebelum musim hujan puncak.',
    category: 'masjid', collected: 38_910_500, target: 90_000_000, donors: 503, daysLeft: 12,
    status: 'published', amountType: 'open', min: 10_000, max: 50_000_000,
    suggested: [20_000, 50_000, 100_000, 500_000], packages: [], hue: 200,
    disbursed: 0, opsFee: 1_945_525, bankFee: 88_000,
  },
  {
    id: 'c4', slug: 'makan-bergizi-santri-pelosok', title: 'Makan Bergizi Harian untuk Santri Pesantren Pelosok',
    short: 'Rp15.000 cukup untuk satu porsi makan bergizi seorang santri.',
    category: 'yatim-dhuafa', collected: 22_675_000, target: null, donors: 1_208, daysLeft: null,
    status: 'published', amountType: 'open', min: 10_000, max: 25_000_000,
    suggested: [15_000, 45_000, 150_000, 450_000], packages: [], hue: 20,
    disbursed: 18_000_000, opsFee: 1_133_750, bankFee: 96_000,
  },
  {
    id: 'c5', slug: 'tanggap-banjir-demak', title: 'Tanggap Darurat Banjir: Dapur Umum & Selimut',
    short: 'Ribuan warga mengungsi. Bantu kebutuhan makan dan selimut untuk pengungsi.',
    category: 'bencana-alam', collected: 146_300_000, target: 150_000_000, donors: 3_902, daysLeft: 3,
    status: 'published', amountType: 'open', min: 10_000, max: 100_000_000,
    suggested: [50_000, 100_000, 200_000, 500_000], packages: [], hue: 215,
    disbursed: 120_000_000, opsFee: 7_315_000, bankFee: 512_000,
  },
  {
    id: 'c6', slug: 'operasi-katarak-lansia', title: 'Operasi Katarak Gratis untuk 100 Lansia Dhuafa',
    short: 'Mengembalikan penglihatan para lansia agar kembali mandiri.',
    category: 'kesehatan', collected: 101_000_000, target: 100_000_000, donors: 1_457, daysLeft: 0,
    status: 'completed', amountType: 'fixed', min: 500_000, max: null, suggested: [], hue: 280,
    packages: [{ id: 'p5', label: 'Satu Mata', amount: 1_000_000, active: true }],
    disbursed: 96_000_000, opsFee: 5_050_000, bankFee: 230_000,
  },
];

export const recentDonors = [
  { name: 'Hamba Allah', amount: 100_000, ago: '3 menit lalu', prayer: 'Semoga airnya membawa berkah untuk warga.' },
  { name: 'Siti Rahmawati', amount: 50_000, ago: '12 menit lalu', prayer: '' },
  { name: 'Hamba Allah', amount: 1_000_000, ago: '27 menit lalu', prayer: 'Untuk almarhumah ibu, semoga jadi amal jariyah.' },
  { name: 'Budi Santoso', amount: 25_000, ago: '1 jam lalu', prayer: '' },
  { name: 'Keluarga Pak Darmawan', amount: 250_000, ago: '2 jam lalu', prayer: 'Bismillah, semoga lancar.' },
];

export const news = [
  {
    slug: 'pengeboran-tahap-1-selesai', campaign: 'c1', date: '2 November 2026',
    title: 'Pengeboran Tahap 1 Selesai, Air Muncul di Kedalaman 82 Meter',
    excerpt: 'Alhamdulillah, tim berhasil menemukan sumber air. Tahap berikutnya pemasangan pompa dan tandon.',
  },
  {
    slug: 'penyaluran-dana-tahap-1', campaign: 'c1', date: '18 Oktober 2026',
    title: 'Penyaluran Dana Tahap 1 Rp95.000.000 untuk Survei & Pengeboran',
    excerpt: 'Rincian penggunaan dana untuk survei geolistrik, sewa alat bor, dan pipa casing.',
  },
  {
    slug: 'survei-lokasi', campaign: 'c1', date: '1 Oktober 2026',
    title: 'Survei Lokasi Bersama Tokoh Desa Oebelo',
    excerpt: 'Tim relawan dan aparat desa menentukan titik pengeboran terbaik.',
  },
];

export interface Trx {
  code: string; campaign: string; donor: string; email: string; phone?: string; amount: number;
  method: string; provider: 'Midtrans'; status: TrxStatus; createdAt: string; paidAt?: string; anonymous?: boolean;
}
export const transactions: Trx[] = [
  { code: 'TK-261109-7QF3KD', campaign: 'Sumur Bor untuk 300 Keluarga di Desa Oebelo, NTT', donor: 'Ahmad Fauzi', email: 'ahmad.fauzi@example.com', phone: '+6281234500011', amount: 250_000, method: 'QRIS', provider: 'Midtrans', status: 'paid', createdAt: '9 Nov 2026 08:14', paidAt: '9 Nov 2026 08:15' },
  { code: 'TK-261109-M2C8RA', campaign: 'Paket Sekolah untuk 500 Anak Yatim', donor: 'Nurul Hidayah', email: 'nurul.h@example.com', amount: 350_000, method: 'BCA Virtual Account', provider: 'Midtrans', status: 'pending', createdAt: '9 Nov 2026 07:52' },
  { code: 'TK-261108-Z9W1TB', campaign: 'Renovasi Atap Masjid Al-Ikhlas', donor: 'Hamba Allah', email: 'r.pratama@example.com', amount: 1_000_000, method: 'GoPay', provider: 'Midtrans', status: 'paid', createdAt: '8 Nov 2026 21:03', paidAt: '8 Nov 2026 21:04', anonymous: true },
  { code: 'TK-261108-H4KJ2N', campaign: 'Makan Bergizi Harian untuk Santri', donor: 'Dewi Lestari', email: 'dewi.lestari@example.com', amount: 45_000, method: 'ShopeePay', provider: 'Midtrans', status: 'expired', createdAt: '8 Nov 2026 18:40' },
  { code: 'TK-261108-P7DD0X', campaign: 'Tanggap Darurat Banjir', donor: 'Rizky Maulana', email: 'rizky.m@example.com', amount: 500_000, method: 'Mandiri Bill', provider: 'Midtrans', status: 'paid', createdAt: '8 Nov 2026 15:22', paidAt: '8 Nov 2026 16:01' },
  { code: 'TK-261107-B3NR6Q', campaign: 'Sumur Bor untuk 300 Keluarga di Desa Oebelo, NTT', donor: 'Fitri Handayani', email: 'fitri.h@example.com', amount: 100_000, method: 'BRI Virtual Account', provider: 'Midtrans', status: 'failed', createdAt: '7 Nov 2026 10:11' },
  { code: 'TK-261107-Q8VX4M', campaign: 'Paket Sekolah untuk 500 Anak Yatim', donor: 'Hendra Wijaya', email: 'hendra.w@example.com', amount: 3_500_000, method: 'BNI Virtual Account', provider: 'Midtrans', status: 'paid', createdAt: '7 Nov 2026 09:30', paidAt: '7 Nov 2026 11:47' },
  { code: 'TK-261106-A1GT9Z', campaign: 'Tanggap Darurat Banjir', donor: 'Ahmad Fauzi', email: 'ahmad.fauzi@example.com', amount: 200_000, method: 'QRIS', provider: 'Midtrans', status: 'paid', createdAt: '6 Nov 2026 19:05', paidAt: '6 Nov 2026 19:06' },
];

export const donors = [
  { name: 'Ahmad Fauzi', email: 'ahmad.fauzi@example.com', phone: '+62812****0011', total: 4_750_000, count: 14, last: '9 Nov 2026', account: true },
  { name: 'Nurul Hidayah', email: 'nurul.h@example.com', phone: '+62857****2210', total: 1_200_000, count: 5, last: '9 Nov 2026', account: true },
  { name: 'Hendra Wijaya', email: 'hendra.w@example.com', phone: '—', total: 12_500_000, count: 6, last: '7 Nov 2026', account: false },
  { name: 'Rizky Maulana', email: 'rizky.m@example.com', phone: '+62813****7781', total: 950_000, count: 3, last: '8 Nov 2026', account: true },
  { name: 'Dewi Lestari', email: 'dewi.lestari@example.com', phone: '—', total: 135_000, count: 3, last: '8 Nov 2026', account: false },
  { name: 'Fitri Handayani', email: 'fitri.h@example.com', phone: '+62821****3009', total: 300_000, count: 2, last: '7 Nov 2026', account: false },
];

export interface PayMethod { code: string; name: string; group: 'QRIS' | 'E-Wallet' | 'Virtual Account' | 'Bill Payment'; provider: 'Midtrans'; active: boolean; order: number; expiry: string; color: string }
export const paymentMethods: PayMethod[] = [
  { code: 'qris', name: 'QRIS', group: 'QRIS', provider: 'Midtrans', active: true, order: 1, expiry: '15 menit', color: '#111827' },
  { code: 'gopay', name: 'GoPay', group: 'E-Wallet', provider: 'Midtrans', active: true, order: 2, expiry: '15 menit', color: '#00AED6' },
  { code: 'shopeepay', name: 'ShopeePay', group: 'E-Wallet', provider: 'Midtrans', active: true, order: 3, expiry: '15 menit', color: '#EE4D2D' },
  { code: 'bca_va', name: 'BCA Virtual Account', group: 'Virtual Account', provider: 'Midtrans', active: true, order: 4, expiry: '24 jam', color: '#0060AF' },
  { code: 'bni_va', name: 'BNI Virtual Account', group: 'Virtual Account', provider: 'Midtrans', active: true, order: 5, expiry: '24 jam', color: '#F15A23' },
  { code: 'bri_va', name: 'BRI Virtual Account', group: 'Virtual Account', provider: 'Midtrans', active: true, order: 6, expiry: '24 jam', color: '#00529C' },
  { code: 'permata_va', name: 'Permata Virtual Account', group: 'Virtual Account', provider: 'Midtrans', active: true, order: 7, expiry: '24 jam', color: '#8DC63F' },
  { code: 'cimb_va', name: 'CIMB Niaga Virtual Account', group: 'Virtual Account', provider: 'Midtrans', active: true, order: 8, expiry: '24 jam', color: '#7B1113' },
  { code: 'mandiri_bill', name: 'Mandiri Bill Payment', group: 'Bill Payment', provider: 'Midtrans', active: true, order: 9, expiry: '24 jam', color: '#003D79' },
];

export const templates = [
  { id: 't1', event: 'payment.pending', channel: 'Email', name: 'Menunggu Pembayaran', active: true, updated: '5 Nov 2026', subject: 'Selesaikan donasimu untuk {{campaign_title}}' },
  { id: 't2', event: 'payment.paid', channel: 'Email', name: 'Donasi Berhasil', active: true, updated: '5 Nov 2026', subject: 'Jazakallah khairan, {{donor_name}} 🤍' },
  { id: 't3', event: 'receipt.issued', channel: 'Email', name: 'Kuitansi Donasi', active: true, updated: '5 Nov 2026', subject: 'Kuitansi donasi {{transaction_id}}' },
  { id: 't4', event: 'payment.expired', channel: 'Email', name: 'Pembayaran Kedaluwarsa', active: true, updated: '3 Nov 2026', subject: 'Pembayaran donasimu kedaluwarsa' },
  { id: 't5', event: 'payment.failed', channel: 'Email', name: 'Pembayaran Gagal', active: true, updated: '3 Nov 2026', subject: 'Pembayaran donasimu belum berhasil' },
  { id: 't6', event: 'donation.created', channel: 'Email', name: 'Donasi Dibuat', active: false, updated: '1 Nov 2026', subject: 'Donasimu untuk {{campaign_title}} tercatat' },
  { id: 't7', event: 'payment.pending', channel: 'WhatsApp', name: 'WA Menunggu Pembayaran', active: true, updated: '5 Nov 2026' },
  { id: 't8', event: 'payment.paid', channel: 'WhatsApp', name: 'WA Donasi Berhasil', active: true, updated: '5 Nov 2026' },
  { id: 't9', event: 'payment.failed', channel: 'WhatsApp', name: 'WA Pembayaran Gagal', active: false, updated: '1 Nov 2026' },
];

export const templateVariables = ['donor_name', 'donor_email', 'donor_phone', 'campaign_title', 'transaction_id', 'donation_amount', 'payment_method', 'payment_status', 'payment_url', 'payment_instruction', 'created_at'];

export const notificationLogs = [
  { id: 'n1', channel: 'Email', recipient: 'ah***@example.com', template: 'Donasi Berhasil', trx: 'TK-261109-7QF3KD', status: 'sent', response: '250 2.0.0 OK', sentAt: '9 Nov 2026 08:15:12' },
  { id: 'n2', channel: 'WhatsApp', recipient: '+62812****0011', template: 'WA Donasi Berhasil', trx: 'TK-261109-7QF3KD', status: 'sent', response: '{"status":true}', sentAt: '9 Nov 2026 08:15:14' },
  { id: 'n3', channel: 'Email', recipient: 'nu***@example.com', template: 'Menunggu Pembayaran', trx: 'TK-261109-M2C8RA', status: 'sent', response: '250 2.0.0 OK', sentAt: '9 Nov 2026 07:52:40' },
  { id: 'n4', channel: 'WhatsApp', recipient: '+62857****2210', template: 'WA Menunggu Pembayaran', trx: 'TK-261109-M2C8RA', status: 'failed', response: '{"status":false,"reason":"device disconnected"}', sentAt: '9 Nov 2026 07:52:41' },
  { id: 'n5', channel: 'Email', recipient: 'de***@example.com', template: 'Pembayaran Kedaluwarsa', trx: 'TK-261108-H4KJ2N', status: 'sent', response: '250 2.0.0 OK', sentAt: '8 Nov 2026 18:56:03' },
  { id: 'n6', channel: 'WhatsApp', recipient: '—', template: 'WA Donasi Berhasil', trx: 'TK-261108-Z9W1TB', status: 'skipped', response: 'Tanpa opt-in WhatsApp', sentAt: '8 Nov 2026 21:04:22' },
];

export const paymentEvents = [
  { id: 'e1', provider: 'Midtrans', type: 'webhook', ref: 'TK-261109-7QF3KD', reported: 'settlement', verification: 'verified', result: 'processed', at: '9 Nov 2026 08:15:09' },
  { id: 'e2', provider: 'Midtrans', type: 'webhook', ref: 'TK-261109-7QF3KD', reported: 'settlement', verification: 'verified', result: 'duplicate', at: '9 Nov 2026 08:15:41' },
  { id: 'e3', provider: 'Midtrans', type: 'create_request', ref: 'TK-261109-M2C8RA', reported: 'pending', verification: 'verified', result: 'processed', at: '9 Nov 2026 07:52:38' },
  { id: 'e4', provider: 'Midtrans', type: 'webhook', ref: '—', reported: 'settlement', verification: 'rejected', result: 'error', at: '9 Nov 2026 03:12:55' },
  { id: 'e5', provider: 'Midtrans', type: 'status_check', ref: 'TK-261108-H4KJ2N', reported: 'expire', verification: 'verified', result: 'processed', at: '8 Nov 2026 18:56:01' },
  { id: 'e6', provider: 'Midtrans', type: 'webhook', ref: 'TK-261108-P7DD0X', reported: 'settlement', verification: 'verified', result: 'processed', at: '8 Nov 2026 16:01:17' },
];

export const dailyDonations = [
  12.4, 18.1, 9.8, 22.5, 31.2, 15.7, 14.9, 19.3, 26.8, 41.5, 38.2, 21.4, 17.6, 24.9, 29.3,
  33.8, 27.1, 19.9, 23.4, 35.6, 48.2, 52.7, 31.9, 28.4, 26.1, 30.7, 36.4, 44.9, 39.3, 46.8,
].map((v) => Math.round(v * 1_000_000));
