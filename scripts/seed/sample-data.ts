// Generator data contoh (dev/preview) — deterministik (PRNG ber-seed, tanggal jangkar tetap)
// agar seed bisa dijalankan ulang tanpa duplikasi. Murni — tanpa akses DB.
import { createHash } from "node:crypto";
import { CROCKFORD_ALPHABET, jakartaDateStamp } from "@/lib/transaction-code";
import { PAYMENT_METHODS } from "./reference-data";

/** PRNG mulberry32 — deterministik untuk seed yang sama. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive);
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!;
  return { next, int, pick };
}

export type Rng = ReturnType<typeof createRng>;

/** Jangkar waktu tetap: semua tanggal contoh relatif terhadap ini (bukan `now`). */
export const SAMPLE_ANCHOR = new Date("2026-11-01T03:00:00Z");
const DAY = 86_400_000;

export type SampleCampaign = {
  slug: string;
  categorySlug: string;
  title: string;
  shortDescription: string;
  amountType: "open" | "fixed";
  targetAmount: bigint | null;
  status: "draft" | "published" | "paused" | "completed";
  isFeatured: boolean;
  /** Gambar contoh di public/images/sample; tanpa ini dipakai placeholder. */
  image?: { url: string; alt: string };
  /** Paket (fixed) atau saran nominal (open). */
  options: { label: string | null; amount: bigint }[];
};

const SUGGESTED = [25_000n, 50_000n, 100_000n, 250_000n].map((amount) => ({ label: null, amount }));

export const SAMPLE_CAMPAIGNS: SampleCampaign[] = [
  {
    slug: "contoh-beasiswa-santri-penghafal-quran",
    categorySlug: "pendidikan",
    title: "Beasiswa Santri Penghafal Al-Qur'an di Pelosok Negeri",
    shortDescription:
      "Bantu biaya pendidikan dan asrama santri penghafal Al-Qur'an dari keluarga prasejahtera.",
    amountType: "open",
    targetAmount: 150_000_000n,
    status: "published",
    isFeatured: true,
    options: SUGGESTED,
  },
  {
    slug: "contoh-sedekah-subuh-harian",
    categorySlug: "lainnya",
    title: "Sedekah Subuh Harian untuk Kebaikan Bersama",
    shortDescription:
      "Sedekah rutin yang disalurkan ke program kebaikan paling membutuhkan setiap pekan.",
    amountType: "open",
    targetAmount: null,
    status: "published",
    isFeatured: false,
    options: SUGGESTED,
  },
  {
    slug: "contoh-paket-sembako-dhuafa",
    categorySlug: "yatim-dhuafa",
    title: "Paket Sembako untuk Keluarga Dhuafa dan Lansia",
    shortDescription:
      "Satu paket sembako berisi beras, minyak, gula, dan telur untuk satu keluarga dhuafa.",
    amountType: "fixed",
    targetAmount: 60_000_000n,
    status: "published",
    isFeatured: true,
    options: [
      { label: "1 paket sembako", amount: 150_000n },
      { label: "2 paket sembako", amount: 300_000n },
      { label: "5 paket sembako", amount: 750_000n },
    ],
  },
  {
    slug: "contoh-renovasi-masjid-desa",
    image: {
      url: "/images/sample/masjid-pelosok.webp",
      alt: "Perbandingan bangunan masjid di pelosok sebelum dan sesudah dibangun",
    },
    categorySlug: "masjid",
    title: "Renovasi Atap Masjid Desa yang Rusak Diterpa Hujan",
    shortDescription: "Atap masjid bocor di banyak titik; jamaah kesulitan salat saat hujan turun.",
    amountType: "open",
    targetAmount: 250_000_000n,
    status: "published",
    isFeatured: false,
    options: SUGGESTED,
  },
  {
    slug: "contoh-dana-darurat-kemanusiaan",
    image: {
      url: "/images/sample/tanggap-bencana.webp",
      alt: "Relawan membawa bantuan logistik menuju lokasi bencana",
    },
    categorySlug: "kemanusiaan",
    title: "Dana Darurat Kemanusiaan untuk Bantuan Cepat",
    shortDescription: "Dana siaga untuk merespons kebutuhan darurat kemanusiaan secara cepat.",
    amountType: "open",
    targetAmount: null,
    status: "paused",
    isFeatured: false,
    options: SUGGESTED,
  },
  {
    slug: "contoh-paket-hygiene-korban-banjir",
    categorySlug: "bencana-alam",
    title: "Paket Kebersihan untuk Pengungsi Korban Banjir",
    shortDescription:
      "Paket sabun, sikat gigi, pembalut, dan handuk untuk keluarga di posko pengungsian.",
    amountType: "fixed",
    targetAmount: 40_000_000n,
    status: "completed",
    isFeatured: false,
    options: [
      { label: "1 paket kebersihan", amount: 100_000n },
      { label: "3 paket kebersihan", amount: 300_000n },
    ],
  },
  {
    slug: "contoh-ambulans-gratis-dhuafa",
    categorySlug: "kesehatan",
    title: "Pengadaan Ambulans Gratis untuk Warga Dhuafa",
    shortDescription:
      "Ambulans siaga 24 jam tanpa biaya untuk warga kurang mampu di daerah terpencil.",
    amountType: "open",
    targetAmount: 450_000_000n,
    status: "draft",
    isFeatured: false,
    options: SUGGESTED,
  },
  {
    slug: "contoh-paket-pangan-palestina",
    categorySlug: "palestina",
    title: "Paket Pangan Keluarga untuk Saudara di Palestina",
    shortDescription: "Paket pangan siap saji untuk keluarga terdampak krisis kemanusiaan.",
    amountType: "fixed",
    targetAmount: 100_000_000n,
    status: "draft",
    isFeatured: false,
    options: [
      { label: "1 paket pangan", amount: 200_000n },
      { label: "5 paket pangan", amount: 1_000_000n },
    ],
  },
];

export type SampleNews = {
  campaignSlug: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  publishedAt: Date | null;
};

/** 12 berita untuk campaign non-draft. */
export function buildSampleNews(): SampleNews[] {
  const topics = [
    "Laporan penyaluran tahap pertama",
    "Kabar terbaru dari lapangan",
    "Terima kasih para donatur",
  ];
  const targets = SAMPLE_CAMPAIGNS.filter((c) => c.status !== "draft").slice(0, 4);
  const news: SampleNews[] = [];
  targets.forEach((c, ci) => {
    topics.forEach((topic, ti) => {
      const n = ci * topics.length + ti;
      const isDraft = n % 6 === 5;
      news.push({
        campaignSlug: c.slug,
        slug: `berita-${ti + 1}`,
        title: `${topic}: ${c.title}`.slice(0, 200),
        status: isDraft ? "draft" : "published",
        publishedAt: isDraft ? null : new Date(SAMPLE_ANCHOR.getTime() - (60 - n * 4) * DAY),
      });
    });
  });
  return news;
}

const FIRST = [
  "Ahmad",
  "Siti",
  "Budi",
  "Nur",
  "Rizky",
  "Aisyah",
  "Fajar",
  "Dewi",
  "Hasan",
  "Laila",
];
const LAST = ["Pratama", "Rahmawati", "Santoso", "Hidayat"];

export type SampleDonor = {
  key: number;
  email: string;
  name: string;
  phoneE164: string | null;
  whatsappOptIn: boolean;
  hasAccount: boolean;
};

/** 40 donor fiktif @example.com; 10 pertama punya akun; nomor +628000000xxxx. */
export function buildSampleDonors(): SampleDonor[] {
  return Array.from({ length: 40 }, (_, i) => {
    const n = i + 1;
    const hasPhone = n % 4 !== 0;
    return {
      key: n,
      email: `donatur${String(n).padStart(2, "0")}@example.com`,
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
      phoneE164: hasPhone ? `+628000000${String(n).padStart(4, "0")}` : null,
      whatsappOptIn: hasPhone && n % 2 === 1,
      hasAccount: n <= 10,
    };
  });
}

export type TxStatus =
  "created" | "pending" | "paid" | "expired" | "failed" | "cancelled" | "refunded";

/** Distribusi 300 transaksi lintas status. */
export const TX_STATUS_COUNTS: Record<TxStatus, number> = {
  paid: 180,
  pending: 30,
  created: 15,
  expired: 40,
  failed: 15,
  cancelled: 15,
  refunded: 5,
};

export type SampleTransaction = {
  code: string;
  campaignSlug: string;
  donorKey: number;
  amount: bigint;
  /** Indeks opsi nominal campaign (untuk fixed), atau null. */
  optionIndex: number | null;
  status: TxStatus;
  createdAt: Date;
  paidAt: Date | null;
  isAnonymous: boolean;
  prayer: string | null;
  methodCode: string | null;
  accessTokenHash: Buffer;
};

const OPEN_AMOUNTS = [
  10_000n,
  20_000n,
  25_000n,
  50_000n,
  75_000n,
  100_000n,
  250_000n,
  500_000n,
  1_000_000n,
];
const PRAYERS = [
  "Semoga menjadi amal jariyah untuk kedua orang tua kami.",
  "Bismillah, semoga berkah dan bermanfaat.",
  "Semoga Allah mudahkan urusan saudara-saudara kita.",
  "Untuk almarhumah ibu, semoga lapang kuburnya.",
];

function codeFor(rng: Rng, at: Date): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += CROCKFORD_ALPHABET[rng.int(32)];
  return `TK-${jakartaDateStamp(at)}-${suffix}`;
}

/** 300 transaksi deterministik. Campaign draft tidak menerima transaksi. */
export function buildSampleTransactions(seed = 20261110): SampleTransaction[] {
  const rng = createRng(seed);
  const campaigns = SAMPLE_CAMPAIGNS.filter((c) => c.status !== "draft");
  const statuses = (Object.entries(TX_STATUS_COUNTS) as [TxStatus, number][]).flatMap(([s, n]) =>
    Array<TxStatus>(n).fill(s),
  );
  const codes = new Set<string>();
  return statuses.map((status, i) => {
    const campaign = rng.pick(campaigns);
    const createdAt = new Date(SAMPLE_ANCHOR.getTime() - rng.int(90 * DAY));
    let code = codeFor(rng, createdAt);
    while (codes.has(code)) code = codeFor(rng, createdAt);
    codes.add(code);
    let amount: bigint;
    let optionIndex: number | null = null;
    if (campaign.amountType === "fixed") {
      optionIndex = rng.int(campaign.options.length);
      amount = campaign.options[optionIndex]!.amount;
    } else {
      amount = rng.pick(OPEN_AMOUNTS);
    }
    const hasPayment = status !== "created";
    const paidAt =
      status === "paid" || status === "refunded"
        ? new Date(createdAt.getTime() + 60_000 + rng.int(3 * 3_600_000))
        : null;
    return {
      code,
      campaignSlug: campaign.slug,
      donorKey: 1 + rng.int(40),
      amount,
      optionIndex,
      status,
      createdAt,
      paidAt,
      isAnonymous: rng.int(5) === 0,
      prayer: rng.int(3) === 0 ? rng.pick(PRAYERS) : null,
      methodCode: hasPayment ? rng.pick(PAYMENT_METHODS).code : null,
      accessTokenHash: createHash("sha256").update(`sample-access:${seed}:${i}`).digest(),
    };
  });
}

/** Nomor kuitansi KW/YYYY/NNNNNN berurutan per tahun (Asia/Jakarta) menurut paid_at. */
export function assignReceiptNumbers(
  txs: readonly Pick<SampleTransaction, "code" | "status" | "paidAt">[],
): { receipts: Map<string, string>; lastSeqByYear: Map<number, number> } {
  const yearOf = (d: Date) =>
    Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(d),
    );
  const paid = txs
    .filter((t) => t.status === "paid" && t.paidAt)
    .sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime() || a.code.localeCompare(b.code));
  const receipts = new Map<string, string>();
  const lastSeqByYear = new Map<number, number>();
  for (const t of paid) {
    const year = yearOf(t.paidAt!);
    const seq = (lastSeqByYear.get(year) ?? 0) + 1;
    lastSeqByYear.set(year, seq);
    receipts.set(t.code, `KW/${year}/${String(seq).padStart(6, "0")}`);
  }
  return { receipts, lastSeqByYear };
}

/** Total per campaign dari transaksi `paid` (acuan uji; DB dihitung ulang via SQL). */
export function paidTotalsByCampaign(
  txs: readonly Pick<SampleTransaction, "campaignSlug" | "status" | "amount">[],
): Map<string, { collected: bigint; count: number }> {
  const totals = new Map<string, { collected: bigint; count: number }>();
  for (const t of txs) {
    if (t.status !== "paid") continue;
    const cur = totals.get(t.campaignSlug) ?? { collected: 0n, count: 0 };
    totals.set(t.campaignSlug, { collected: cur.collected + t.amount, count: cur.count + 1 });
  }
  return totals;
}
