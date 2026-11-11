/**
 * FAQ landing page (P30, LB §14). SATU sumber untuk UI dan JSON-LD FAQPage.
 * Butir `pending` bergantung keputusan yang belum ada → TIDAK tampil di halaman maupun JSON-LD
 * sampai jawabannya diisi dan status diubah ke `ready`.
 */
export interface FaqEntry {
  question: string;
  answer: string;
  status: "ready" | "pending";
  /** Alasan tertunda (untuk PM; tidak pernah dirender). */
  pendingReason?: string;
}

export const LANDING_FAQ: readonly FaqEntry[] = [
  {
    question: "Apakah saya harus membuat akun untuk berdonasi?",
    answer:
      "Tidak. Kamu bisa berdonasi sebagai tamu cukup dengan nama dan email. Masuk dengan Google bersifat opsional, berguna untuk melihat riwayat donasi dan mengunduh kuitansi kapan saja.",
    status: "ready",
  },
  {
    question: "Apakah ada biaya tambahan saat berdonasi?",
    answer:
      "Tidak ada biaya tambahan untuk donatur. Biaya metode pembayaran ditanggung lembaga, sehingga kamu membayar tepat sebesar nominal donasi. Kebijakan biaya operasional program: [ISI DATA: kebijakan OD-05].",
    status: "pending",
    pendingReason: "OD-05 (biaya operasional) belum diputuskan",
  },
  {
    question: "Metode pembayaran apa saja yang tersedia?",
    answer:
      "[ISI DATA: daftar metode yang aktif di akun Midtrans produksi]. Pilihan metode tampil di langkah pembayaran.",
    status: "pending",
    pendingReason: "Metode aktif di akun Midtrans produksi belum ditetapkan (P27 ditunda)",
  },
  {
    question: "Apakah pembayaran saya aman?",
    answer:
      "Pembayaran diproses oleh Midtrans. Status donasi hanya berubah setelah dikonfirmasi oleh penyedia pembayaran. Kami tidak pernah meminta PIN, OTP, atau password kamu.",
    status: "ready",
  },
  {
    question: "Kapan saya menerima kuitansi?",
    answer:
      "Kuitansi PDF bernomor terbit otomatis setelah pembayaran terkonfirmasi. Kuitansi dikirim ke email dan bisa diunduh dari halaman transaksi selama 7 hari, atau dari akun kapan saja bila kamu masuk dengan Google memakai email yang sama.",
    status: "ready",
  },
  {
    question: "Bisakah saya berdonasi tanpa menampilkan nama?",
    answer:
      "Bisa. Centang pilihan Hamba Allah saat mengisi data. Nama kamu tidak tampil di publik; email dan nomor WhatsApp tidak pernah ditampilkan.",
    status: "ready",
  },
  {
    question: "Bagaimana saya tahu donasi saya disalurkan?",
    answer:
      "Setiap halaman program menampilkan dana terkumpul, rincian penggunaan dana, dan kabar penyaluran beserta buktinya.",
    status: "ready",
  },
  {
    question: "Berapa nominal minimal donasi?",
    answer: "Nominal minimal mengikuti setiap program dan tertera di formulir donasi.",
    status: "ready",
  },
  {
    question: "Bagaimana jika saya belum menyelesaikan pembayaran?",
    answer:
      "Setiap metode memiliki batas waktu pembayaran yang tertera di halaman instruksi. Bila lewat, transaksi kedaluwarsa dan kamu bisa berdonasi lagi kapan saja.",
    status: "ready",
  },
  {
    question: "Apakah saya akan menerima pesan WhatsApp?",
    answer:
      "Hanya bila kamu mencentang persetujuan WhatsApp pada donasi tersebut. Tanpa centang, kabar dikirim lewat email saja.",
    status: "ready",
  },
];

/** Butir yang boleh tampil (dan masuk JSON-LD). */
export function visibleFaq(entries: readonly FaqEntry[] = LANDING_FAQ): FaqEntry[] {
  return entries.filter((e) => e.status === "ready" && !/\[(ISI DATA|VERIFIKASI)/.test(e.question + e.answer));
}
