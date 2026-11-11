/**
 * Isi halaman legal (T-49, F-32, OD-08). SATU tempat untuk teks, slot data, status draf, dan
 * tanggal. PM/legal cukup mengubah file ini:
 *  1. Ganti setiap `[ISI DATA: …]` dan `[TINJAUAN HUKUM: …]` dengan teks final.
 *  2. Perbarui `LEGAL_UPDATED_AT`.
 *  3. Setel `LEGAL_FINAL = true` → banner draf hilang, halaman menjadi `index` dan masuk
 *     sitemap (lihat `legalRobots()` & `src/app/sitemap.ts`). Test unit menolak `LEGAL_FINAL`
 *     bila masih ada slot di teks.
 *
 * Teks disusun dari perilaku sistem yang benar-benar ada (docs/03-technical/security.md,
 * docs/04-database/database-security.md, open-decisions.md). Bukan salinan teks legal pihak lain.
 */

/** `false` selama teks masih draf (keputusan PM 11 Nov 2026). */
export const LEGAL_FINAL: boolean = false;

/** Tanggal "terakhir diperbarui" (YYYY-MM-DD, zona Asia/Jakarta). */
export const LEGAL_UPDATED_AT = "2026-11-11";

export const LEGAL_DRAFT_NOTICE =
  "Draf — menunggu tinjauan hukum. Belum berlaku sebagai dokumen final.";

export type LegalBlock = string | { list: string[] };

export interface LegalSection {
  heading: string;
  body: LegalBlock[];
}

export interface LegalPageContent {
  path: "/kebijakan-privasi" | "/syarat-ketentuan" | "/tentang" | "/kontak";
  /** Label tautan (footer, /masuk). */
  label: string;
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
}

const PENGELOLA = "[ISI DATA: nama badan hukum pengelola Tebar Kebaikan (OD-02)]";

export const PRIVACY: LegalPageContent = {
  path: "/kebijakan-privasi",
  label: "Kebijakan Privasi",
  title: "Kebijakan Privasi",
  description:
    "Data apa yang dikumpulkan Tebar Kebaikan, untuk apa, dengan siapa dibagikan, dan hak kamu atas datamu.",
  intro: `Kebijakan ini menjelaskan bagaimana Tebar Kebaikan, yang dikelola oleh ${PENGELOLA}, mengumpulkan dan memakai data pribadi saat kamu berdonasi atau masuk ke akun donatur.`,
  sections: [
    {
      heading: "Data yang kami kumpulkan",
      body: [
        "Saat berdonasi (dengan atau tanpa akun):",
        {
          list: [
            "Nama, alamat email, dan nomor WhatsApp (opsional).",
            "Nominal donasi, program yang dipilih, metode pembayaran, dan status pembayaran.",
            'Pilihan tampil sebagai "Hamba Allah", doa yang kamu titipkan (opsional), dan persetujuan menerima WhatsApp untuk donasi tersebut.',
            "Data teknis untuk keamanan: nilai acak (hash) dari alamat IP dan jenis browser (user agent). Alamat IP tidak disimpan dalam bentuk aslinya.",
          ],
        },
        "Saat masuk dengan Google: nama dan alamat email terverifikasi dari akun Google kamu. Kami tidak menerima password Google kamu.",
        "Kami tidak meminta dan tidak menyimpan nomor kartu, PIN, OTP, atau password rekening/e-wallet. Data pembayaran tersebut diproses langsung oleh penyedia pembayaran.",
      ],
    },
    {
      heading: "Untuk apa data dipakai",
      body: [
        {
          list: [
            "Memproses donasi dan pembayaran, termasuk mengirim instruksi pembayaran.",
            "Menerbitkan kuitansi PDF setelah pembayaran terkonfirmasi.",
            "Mengirim kabar status donasi lewat email, dan lewat WhatsApp hanya bila kamu mencentang persetujuan WhatsApp pada donasi tersebut.",
            "Menampilkan riwayat donasi di akun donatur, termasuk menyambungkan donasi tamu yang memakai email Google yang sama.",
            "Mencegah penyalahgunaan (pembatasan jumlah permintaan) dan menjaga keamanan sistem.",
            "Pencatatan keuangan dan audit lembaga.",
          ],
        },
        "Kami tidak menjual data pribadi dan tidak memakainya untuk iklan.",
      ],
    },
    {
      heading: "Yang tampil di publik",
      body: [
        'Di halaman program, daftar donatur menampilkan nama (atau "Hamba Allah" bila kamu memilihnya), nominal, waktu, dan doa yang kamu titipkan. Email dan nomor WhatsApp tidak pernah ditampilkan di publik.',
      ],
    },
    {
      heading: "Pihak yang memproses data",
      body: [
        "Untuk menjalankan layanan, sebagian data diproses oleh penyedia berikut sesuai keperluannya:",
        {
          list: [
            "Midtrans — pemrosesan pembayaran (nama, email, nomor WhatsApp bila diisi, nominal, kode transaksi).",
            "Google — layanan email (Gmail) untuk mengirim instruksi, kabar status, dan kuitansi; serta login dengan Google.",
            "Fonnte — pengiriman WhatsApp, hanya untuk donasi yang kamu beri persetujuan WhatsApp.",
            "Vercel — hosting aplikasi, penyimpanan gambar program, serta statistik kunjungan dan performa halaman tanpa cookie.",
            "Neon — basis data.",
            "Upstash — cache, pembatasan jumlah permintaan, dan antrean tugas terjadwal.",
          ],
        },
        "[TINJAUAN HUKUM: lokasi pemrosesan/penyimpanan data di luar Indonesia dan dasar transfer data lintas negara]",
      ],
    },
    {
      heading: "Cookie dan penyimpanan di browser",
      body: [
        "Kami hanya memakai cookie yang diperlukan agar layanan berjalan: cookie sesi dan keamanan login donatur (saat kamu masuk dengan Google) dan cookie sesi panel admin. Kami tidak memakai cookie iklan atau pelacakan pihak ketiga.",
        "Statistik kunjungan (Vercel Web Analytics) bekerja tanpa cookie dan tanpa mengirim nama, email, nomor WhatsApp, nominal, atau kode transaksi. Browser juga menyimpan penanda sementara (session storage) agar statistik yang sama tidak terhitung dua kali.",
      ],
    },
    {
      heading: "Berapa lama data disimpan",
      body: [
        "Catatan transaksi (kode, nominal, status, kuitansi) disimpan untuk keperluan pencatatan keuangan dan audit lembaga selama [ISI DATA: masa retensi data keuangan & data pribadi (OD-14)].",
        "Tautan halaman transaksi untuk donasi tamu berlaku 7 hari.",
      ],
    },
    {
      heading: "Hak kamu",
      body: [
        {
          list: [
            "Melihat riwayat donasi dan mengunduh kuitansi di akun donatur.",
            "Mengubah nama, nomor WhatsApp, dan preferensi notifikasi di profil akun.",
            'Menghapus akun di halaman profil. Penghapusan langsung dijalankan: nama diganti "Donatur Terhapus", email dan nomor WhatsApp dihapus dari akun dan dari data transaksi, sesi login diakhiri. Kode, nominal, status, dan kuitansi transaksi tetap disimpan untuk pencatatan keuangan.',
            "Bertanya atau mengajukan permintaan lain terkait data pribadi melalui halaman Kontak.",
          ],
        },
        "[ISI DATA: catatan untuk doa yang dititipkan setelah akun dihapus (OD-33)]",
        "[TINJAUAN HUKUM: rujukan peraturan perlindungan data pribadi yang berlaku dan hak subjek data lainnya]",
      ],
    },
    {
      heading: "Keamanan",
      body: [
        "Koneksi ke situs dienkripsi (HTTPS). Akses admin memakai akun terpisah dengan verifikasi dua langkah dan hak akses per peran; setiap perubahan data penting tercatat di log audit. Tidak ada sistem yang sepenuhnya bebas risiko; bila terjadi insiden yang memengaruhi datamu, kami akan [ISI DATA: prosedur pemberitahuan insiden data].",
      ],
    },
    {
      heading: "Perubahan kebijakan",
      body: ['Bila kebijakan ini berubah, tanggal "terakhir diperbarui" di atas ikut berubah.'],
    },
  ],
};

export const TERMS: LegalPageContent = {
  path: "/syarat-ketentuan",
  label: "Syarat & Ketentuan",
  title: "Syarat & Ketentuan",
  description:
    "Ketentuan berdonasi di Tebar Kebaikan: pembayaran, kuitansi, penyaluran, dan penggunaan akun.",
  intro: `Dengan berdonasi atau memakai akun di Tebar Kebaikan, kamu menyetujui ketentuan berikut. Tebar Kebaikan dikelola oleh ${PENGELOLA}.`,
  sections: [
    {
      heading: "Layanan",
      body: [
        "Tebar Kebaikan adalah platform untuk berdonasi ke program kebaikan yang dikelola lembaga. Donasi bisa dilakukan tanpa akun; akun donatur (masuk dengan Google) bersifat opsional untuk melihat riwayat dan kuitansi.",
        "[ISI DATA: izin pengumpulan dana/legalitas lembaga (OD-02)]",
      ],
    },
    {
      heading: "Donasi dan pembayaran",
      body: [
        {
          list: [
            "Nominal minimal dan maksimal mengikuti setiap program dan tertera di formulir donasi.",
            "Biaya metode pembayaran ditanggung lembaga; kamu membayar tepat sebesar nominal donasi.",
            "Pembayaran diproses oleh Midtrans. Donasi dianggap berhasil hanya setelah pembayaran dikonfirmasi oleh penyedia pembayaran, bukan dari konfirmasi manual donatur.",
            "Setiap metode memiliki batas waktu pembayaran yang tertera di halaman instruksi. Transaksi yang melewati batas waktu menjadi kedaluwarsa dan tidak perlu dibayar.",
            "Kuitansi PDF bernomor terbit otomatis setelah pembayaran terkonfirmasi.",
          ],
        },
      ],
    },
    {
      heading: "Penyaluran dana",
      body: [
        "Dana disalurkan ke program yang kamu pilih. Rincian penggunaan dana (disalurkan ke program, biaya operasional, biaya transaksi) dan kabar penyaluran ditampilkan di halaman setiap program.",
        "[ISI DATA: kebijakan biaya operasional (OD-05) dan pengalihan dana bila program tidak dapat dilaksanakan atau melebihi target]",
      ],
    },
    {
      heading: "Pengembalian dana",
      body: [
        "Pengembalian dana tidak dilakukan otomatis. Permintaan diajukan melalui halaman Kontak dan ditinjau oleh lembaga. Bila pengembalian disetujui dan diproses, total terkumpul program ikut dikurangi.",
        "[ISI DATA: syarat, batas waktu, dan cara pengembalian dana]",
      ],
    },
    {
      heading: "Kewajiban donatur",
      body: [
        {
          list: [
            "Mengisi data yang benar, terutama email untuk menerima kuitansi.",
            "Tidak memakai layanan untuk pencucian uang, penipuan, atau tindakan melanggar hukum lainnya.",
            "Menjaga kerahasiaan tautan halaman transaksi (berlaku 7 hari) karena tautan itu memberi akses ke detail donasi.",
            "Doa yang dititipkan tampil di publik; jangan menuliskan data pribadi atau isi yang menyinggung.",
          ],
        },
      ],
    },
    {
      heading: "Akun donatur",
      body: [
        "Akun dibuat dengan masuk menggunakan Google dan email terverifikasi. Kamu dapat menghapus akun kapan saja dari halaman profil; ketentuan data setelah penghapusan dijelaskan di Kebijakan Privasi.",
      ],
    },
    {
      heading: "Batasan tanggung jawab",
      body: [
        "[TINJAUAN HUKUM: batasan tanggung jawab lembaga, gangguan layanan pihak ketiga (pembayaran, email, WhatsApp), dan keadaan kahar]",
      ],
    },
    {
      heading: "Hukum yang berlaku dan penyelesaian sengketa",
      body: ["[TINJAUAN HUKUM: hukum yang berlaku dan forum penyelesaian sengketa]"],
    },
    {
      heading: "Perubahan ketentuan",
      body: ['Bila ketentuan ini berubah, tanggal "terakhir diperbarui" di atas ikut berubah.'],
    },
  ],
};

export const ABOUT: LegalPageContent = {
  path: "/tentang",
  label: "Tentang Kami",
  title: "Tentang Tebar Kebaikan",
  description:
    "Tebar Kebaikan: platform donasi program kebaikan yang mudah, tercatat, dan bisa kamu pantau.",
  intro:
    "Tebar Kebaikan adalah platform donasi untuk program kebaikan — pendidikan, masjid, yatim & dhuafa, hingga kemanusiaan — dengan proses yang mudah, tercatat, dan bisa kamu pantau.",
  sections: [
    {
      heading: "Pengelola",
      body: [PENGELOLA, "[ISI DATA: nomor legalitas dan izin pengumpulan dana (OD-02)]"],
    },
    {
      heading: "Cara kami bekerja",
      body: [
        {
          list: [
            "Donasi tanpa wajib membuat akun.",
            'Status pembayaran dikonfirmasi oleh penyedia pembayaran, bukan dari klik "saya sudah bayar".',
            "Kuitansi PDF bernomor terbit otomatis setelah pembayaran terkonfirmasi.",
            "Rincian penggunaan dana dan kabar penyaluran tampil di halaman setiap program.",
            "Kami tidak pernah meminta PIN, OTP, atau password kamu.",
          ],
        },
      ],
    },
    {
      heading: "Visi dan misi",
      body: ["[ISI DATA: visi, misi, dan profil singkat lembaga]"],
    },
  ],
};

export const CONTACT: LegalPageContent = {
  path: "/kontak",
  label: "Kontak",
  title: "Kontak",
  description:
    "Hubungi pengelola Tebar Kebaikan untuk pertanyaan donasi, kuitansi, atau data pribadi.",
  intro:
    "Untuk pertanyaan seputar donasi, kuitansi, pengembalian dana, atau data pribadi, hubungi kami melalui kontak berikut. Sertakan kode transaksi bila pertanyaanmu tentang donasi tertentu, dan jangan pernah mengirim PIN, OTP, atau password.",
  sections: [],
};

export const LEGAL_PAGES = [ABOUT, PRIVACY, TERMS, CONTACT] as const;

const SLOT_RE = /\[(ISI DATA|TINJAUAN HUKUM)[^\]]*\]/g;

/** Semua slot yang masih harus diisi (untuk laporan & guard test sebelum LEGAL_FINAL). */
export function legalSlots(pages: readonly LegalPageContent[] = LEGAL_PAGES): string[] {
  const text = JSON.stringify(pages);
  return [...new Set(text.match(SLOT_RE) ?? [])];
}

/** Meta robots halaman legal: noindex selama draf. */
export function legalRobots(final: boolean = LEGAL_FINAL) {
  return final ? undefined : { index: false, follow: true };
}
