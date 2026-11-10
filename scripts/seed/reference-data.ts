// Data referensi (docs/04-database/seed-data.md). Murni data — tanpa akses DB.

export const CATEGORIES = [
  { slug: "pendidikan", name: "Pendidikan", icon: "graduation-cap" },
  { slug: "kesehatan", name: "Kesehatan", icon: "heart-pulse" },
  { slug: "kemanusiaan", name: "Kemanusiaan", icon: "hand-heart" },
  { slug: "masjid", name: "Masjid", icon: "landmark" },
  { slug: "yatim-dhuafa", name: "Yatim & Dhuafa", icon: "users" },
  { slug: "bencana-alam", name: "Bencana Alam", icon: "cloud-lightning" },
  { slug: "palestina", name: "Palestina", icon: "flag" },
  { slug: "lainnya", name: "Lainnya", icon: "sparkles" },
] as const;

export const ROLES = [
  { code: "owner", name: "Owner" },
  { code: "admin", name: "Admin" },
  { code: "finance", name: "Keuangan" },
  { code: "editor", name: "Editor" },
] as const;

export type RoleCode = (typeof ROLES)[number]["code"];

export const PERMISSIONS = [
  { code: "campaigns.read", description: "Melihat campaign di admin" },
  { code: "campaigns.write", description: "Membuat & mengubah campaign" },
  { code: "campaigns.publish", description: "Menerbitkan/menjeda campaign" },
  { code: "news.write", description: "Membuat & mengubah berita campaign" },
  { code: "news.publish", description: "Menerbitkan berita campaign" },
  { code: "transactions.read", description: "Melihat transaksi" },
  { code: "transactions.export", description: "Ekspor transaksi" },
  { code: "transactions.reconcile", description: "Cek status ke provider / rekonsiliasi" },
  { code: "donors.read", description: "Melihat data donatur" },
  { code: "donors.export", description: "Ekspor data donatur" },
  { code: "payment_methods.write", description: "Mengatur metode pembayaran" },
  { code: "disbursements.write", description: "Mencatat penyaluran dana" },
  { code: "notifications.write", description: "Mengatur template notifikasi" },
  { code: "settings.write", description: "Mengubah pengaturan platform" },
  { code: "admins.manage", description: "Mengelola akun admin & peran" },
  { code: "audit.read", description: "Melihat audit log" },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]["code"];

/** Matriks BR-40 (docs/02-product/business-rules.md). */
export const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  owner: PERMISSIONS.map((p) => p.code),
  admin: [
    "campaigns.read",
    "campaigns.write",
    "campaigns.publish",
    "news.write",
    "news.publish",
    "transactions.read",
    "transactions.export",
    "transactions.reconcile",
    "donors.read",
    "disbursements.write",
    "notifications.write",
    "audit.read",
  ],
  finance: [
    "campaigns.read",
    "transactions.read",
    "transactions.export",
    "transactions.reconcile",
    "donors.read",
    "donors.export",
    "payment_methods.write",
    "disbursements.write",
    "audit.read",
  ],
  editor: ["campaigns.read", "campaigns.write", "news.write", "news.publish"],
};

export const PROVIDER = { code: "midtrans", name: "Midtrans", priority: 1, isEnabled: false };

type Instruction = { title: string; steps: string[] };
type MethodType = "qris" | "ewallet" | "virtual_account";

function vaInstructions(bank: string, mbanking: string): Instruction[] {
  return [
    {
      title: `${mbanking}`,
      steps: [
        `Buka aplikasi ${mbanking} dan masuk ke akun Anda.`,
        "Pilih menu Transfer, lalu Virtual Account.",
        "Masukkan nomor Virtual Account {{va_number}}.",
        "Pastikan nama penerima dan nominal {{amount}} sudah sesuai.",
        "Masukkan PIN untuk menyelesaikan pembayaran.",
      ],
    },
    {
      title: `ATM ${bank}`,
      steps: [
        "Masukkan kartu ATM dan PIN Anda.",
        "Pilih menu Transaksi Lainnya, lalu Transfer, lalu Virtual Account.",
        "Masukkan nomor Virtual Account {{va_number}}.",
        "Periksa detail pembayaran ({{amount}}), lalu konfirmasi.",
        "Simpan struk sebagai bukti pembayaran.",
      ],
    },
    {
      title: "Bank lain",
      steps: [
        "Pilih menu Transfer Antarbank di aplikasi atau ATM bank Anda.",
        "Pilih {{bank_name}} sebagai bank tujuan.",
        "Masukkan nomor Virtual Account {{va_number}} dan nominal {{amount}} persis.",
        "Konfirmasi dan selesaikan pembayaran.",
      ],
    },
  ];
}

const ewallet = (app: string): Instruction[] => [
  {
    title: `Aplikasi ${app}`,
    steps: [
      `Tekan tombol "Bayar dengan ${app}" untuk membuka aplikasi ${app}.`,
      "Periksa detail pembayaran dan nominal {{amount}}.",
      "Masukkan PIN untuk menyelesaikan pembayaran.",
    ],
  },
  {
    title: "Pindai QR (desktop)",
    steps: [
      `Buka aplikasi ${app} di ponsel Anda, lalu pilih menu Bayar/Scan.`,
      "Pindai kode QR yang tampil di layar.",
      "Periksa nominal {{amount}}, lalu konfirmasi dengan PIN.",
    ],
  },
];

export const PAYMENT_METHODS: {
  code: string;
  providerChannel: string;
  type: MethodType;
  displayName: string;
  expiryMinutes: number;
  instructions: Instruction[];
}[] = [
  {
    code: "qris",
    providerChannel: "qris",
    type: "qris",
    displayName: "QRIS",
    expiryMinutes: 15,
    instructions: [
      {
        title: "Bayar dengan QRIS",
        steps: [
          "Buka aplikasi m-banking atau e-wallet yang mendukung QRIS.",
          "Pilih menu Scan/Bayar, lalu pindai kode QR yang tampil.",
          "Pastikan nominal {{amount}} sudah sesuai.",
          "Konfirmasi pembayaran dengan PIN Anda.",
        ],
      },
    ],
  },
  {
    code: "gopay",
    providerChannel: "gopay",
    type: "ewallet",
    displayName: "GoPay",
    expiryMinutes: 15,
    instructions: ewallet("GoPay"),
  },
  {
    code: "shopeepay",
    providerChannel: "shopeepay",
    type: "ewallet",
    displayName: "ShopeePay",
    expiryMinutes: 15,
    instructions: ewallet("ShopeePay"),
  },
  {
    code: "bca_va",
    providerChannel: "bca",
    type: "virtual_account",
    displayName: "BCA Virtual Account",
    expiryMinutes: 1440,
    instructions: vaInstructions("BCA", "BCA mobile"),
  },
  {
    code: "bni_va",
    providerChannel: "bni",
    type: "virtual_account",
    displayName: "BNI Virtual Account",
    expiryMinutes: 1440,
    instructions: vaInstructions("BNI", "BNI Mobile Banking"),
  },
  {
    code: "bri_va",
    providerChannel: "bri",
    type: "virtual_account",
    displayName: "BRI Virtual Account",
    expiryMinutes: 1440,
    instructions: vaInstructions("BRI", "BRImo"),
  },
  {
    code: "permata_va",
    providerChannel: "permata",
    type: "virtual_account",
    displayName: "Permata Virtual Account",
    expiryMinutes: 1440,
    instructions: vaInstructions("Permata", "PermataMobile X"),
  },
  {
    code: "cimb_va",
    providerChannel: "cimb",
    type: "virtual_account",
    displayName: "CIMB Niaga Virtual Account",
    expiryMinutes: 1440,
    instructions: vaInstructions("CIMB Niaga", "OCTO Mobile"),
  },
  {
    code: "mandiri_bill",
    providerChannel: "echannel",
    type: "virtual_account",
    displayName: "Mandiri Bill Payment",
    expiryMinutes: 1440,
    instructions: [
      {
        title: "Livin' by Mandiri",
        steps: [
          "Buka aplikasi Livin' by Mandiri, pilih menu Bayar, lalu E-Commerce/Multipayment.",
          "Masukkan kode perusahaan (biller code) yang tertera.",
          "Masukkan kode bayar {{va_number}}.",
          "Periksa nominal {{amount}}, lalu konfirmasi dengan PIN.",
        ],
      },
      {
        title: "ATM Mandiri",
        steps: [
          "Pilih menu Bayar/Beli, lalu Lainnya, lalu Multi Payment.",
          "Masukkan kode perusahaan (biller code) yang tertera.",
          "Masukkan kode bayar {{va_number}}, lalu Benar.",
          "Periksa nominal {{amount}} dan konfirmasi pembayaran.",
        ],
      },
    ],
  },
];

type Template = {
  event: string;
  channel: "email" | "whatsapp";
  name: string;
  subject: string | null;
  body: string;
  isActive: boolean;
};

/** 7 email + 4 WhatsApp (docs/03-technical/notification-architecture.md). `donation.created` nonaktif (OD-10). */
export const NOTIFICATION_TEMPLATES: Template[] = [
  {
    event: "donation.created",
    channel: "email",
    name: "Donasi dibuat (email)",
    subject: "Donasi Anda untuk {{campaign_title}} telah tercatat",
    body: "Assalamu'alaikum {{donor_name}},\n\nTerima kasih, donasi Anda sebesar {{donation_amount}} untuk {{campaign_title}} telah tercatat dengan nomor {{transaction_id}} pada {{created_at}}.\n\nSilakan lanjutkan pembayaran melalui tautan berikut:\n{{payment_url}}\n\nJazakumullahu khairan.",
    isActive: false,
  },
  {
    event: "payment.pending",
    channel: "email",
    name: "Menunggu pembayaran (email)",
    subject: "Selesaikan pembayaran donasi {{transaction_id}}",
    body: "Assalamu'alaikum {{donor_name}},\n\nDonasi Anda sebesar {{donation_amount}} untuk {{campaign_title}} menunggu pembayaran melalui {{payment_method}}.\n\nCara pembayaran:\n{{payment_instruction}}\n\nLihat detail & batas waktu pembayaran:\n{{payment_url}}\n\nJazakumullahu khairan.",
    isActive: true,
  },
  {
    event: "payment.paid",
    channel: "email",
    name: "Pembayaran berhasil (email)",
    subject: "Alhamdulillah, donasi {{transaction_id}} telah diterima",
    body: "Assalamu'alaikum {{donor_name}},\n\nAlhamdulillah, donasi Anda sebesar {{donation_amount}} untuk {{campaign_title}} telah kami terima melalui {{payment_method}}.\n\nSemoga Allah membalas kebaikan Anda dengan pahala berlipat. Detail transaksi:\n{{payment_url}}\n\nJazakumullahu khairan.",
    isActive: true,
  },
  {
    event: "receipt.issued",
    channel: "email",
    name: "Kuitansi donasi (email)",
    subject: "Kuitansi donasi {{transaction_id}}",
    body: "Assalamu'alaikum {{donor_name}},\n\nKuitansi untuk donasi Anda sebesar {{donation_amount}} kepada {{campaign_title}} sudah tersedia. Unduh kuitansi melalui tautan berikut:\n{{payment_url}}\n\nJazakumullahu khairan.",
    isActive: true,
  },
  {
    event: "payment.failed",
    channel: "email",
    name: "Pembayaran gagal (email)",
    subject: "Pembayaran donasi {{transaction_id}} belum berhasil",
    body: "Assalamu'alaikum {{donor_name}},\n\nMohon maaf, pembayaran donasi Anda sebesar {{donation_amount}} untuk {{campaign_title}} melalui {{payment_method}} belum berhasil (status: {{payment_status}}).\n\nAnda dapat mencoba kembali dengan metode lain melalui tautan berikut:\n{{payment_url}}",
    isActive: true,
  },
  {
    event: "payment.expired",
    channel: "email",
    name: "Pembayaran kedaluwarsa (email)",
    subject: "Batas waktu pembayaran donasi {{transaction_id}} telah habis",
    body: "Assalamu'alaikum {{donor_name}},\n\nBatas waktu pembayaran donasi Anda sebesar {{donation_amount}} untuk {{campaign_title}} telah habis.\n\nBila masih ingin berdonasi, silakan buat donasi baru melalui halaman campaign. Terima kasih atas niat baik Anda.",
    isActive: true,
  },
  {
    event: "account.welcome",
    channel: "email",
    name: "Selamat datang (email)",
    subject: "Selamat datang di Tebar Kebaikan",
    body: "Assalamu'alaikum {{donor_name}},\n\nTerima kasih telah bergabung di Tebar Kebaikan. Melalui akun Anda ({{donor_email}}), Anda dapat melihat riwayat donasi dan mengunduh kuitansi kapan saja.\n\nSemoga setiap kebaikan yang Anda tebar menjadi amal jariyah.",
    isActive: true,
  },
  {
    event: "donation.created",
    channel: "whatsapp",
    name: "Donasi dibuat (WhatsApp)",
    subject: null,
    body: "Assalamu'alaikum {{donor_name}}, donasi Anda {{donation_amount}} untuk {{campaign_title}} telah tercatat (no. {{transaction_id}}). Lanjutkan pembayaran: {{payment_url}}",
    isActive: false,
  },
  {
    event: "payment.pending",
    channel: "whatsapp",
    name: "Menunggu pembayaran (WhatsApp)",
    subject: null,
    body: "Assalamu'alaikum {{donor_name}}, donasi {{donation_amount}} untuk {{campaign_title}} menunggu pembayaran via {{payment_method}}. Detail & batas waktu: {{payment_url}}",
    isActive: true,
  },
  {
    event: "payment.paid",
    channel: "whatsapp",
    name: "Pembayaran berhasil (WhatsApp)",
    subject: null,
    body: "Alhamdulillah, {{donor_name}}. Donasi {{donation_amount}} untuk {{campaign_title}} telah kami terima (no. {{transaction_id}}). Jazakumullahu khairan.",
    isActive: true,
  },
  {
    event: "payment.failed",
    channel: "whatsapp",
    name: "Pembayaran gagal (WhatsApp)",
    subject: null,
    body: "Mohon maaf {{donor_name}}, pembayaran donasi {{donation_amount}} untuk {{campaign_title}} belum berhasil. Coba lagi: {{payment_url}}",
    isActive: true,
  },
];

export const PLATFORM_SETTINGS: { key: string; value: unknown; description: string }[] = [
  {
    key: "platform.max_amount",
    value: 1000000000,
    description: "Nominal donasi maksimum (rupiah)",
  },
  {
    key: "donation.default_min",
    value: 10000,
    description: "Nominal donasi minimum default (rupiah)",
  },
  {
    key: "notifications.whatsapp_enabled",
    value: false,
    description: "Aktifkan pengiriman notifikasi WhatsApp",
  },
  { key: "organization.name", value: "Tebar Kebaikan", description: "Nama lembaga di kuitansi" },
  {
    key: "organization.address",
    value: "Alamat lembaga (ubah di pengaturan)",
    description: "Alamat lembaga di kuitansi",
  },
  {
    key: "receipt.signatory",
    value: "Pengurus Tebar Kebaikan",
    description: "Nama penanda tangan kuitansi",
  },
];
