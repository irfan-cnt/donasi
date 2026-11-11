import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  CreditCard,
  FileText,
  HandCoins,
  HeartHandshake,
  Lock,
  PenLine,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FundProgress } from "@/components/public/fund-progress";
import { buttonVariants } from "@/components/ui/button";
import {
  LEGALITY_BLOCK,
  OPERATIONAL_FEE_SENTENCE,
  STATIC_TRUST_FACTS,
  showPlatformStats,
} from "@/lib/landing";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CampaignCardData, PlatformStats } from "@/server/queries/public-campaigns";

// Section landing page `/` (P30, marketing/landing-page-implementation-brief.md S1–S8).
// Server Component murni (tanpa JS klien); data dari page.tsx (query cached).

const countFormatter = new Intl.NumberFormat("id-ID");

/** S1 — Hero (LB §7 alt. A, §8). Tanpa program unggulan: kartu tidak dirender, CTA ke /campaign. */
export function HeroView({ featured }: { featured: CampaignCardData | null }) {
  return (
    <section data-section="s1" className="relative overflow-hidden bg-primary-ink text-white">
      <div className="absolute inset-0 pattern-islamic" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-8 pb-10 md:grid-cols-2 md:items-center md:py-16">
        <div>
          <span className="inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gold-soft">
            #TebarKebaikan
          </span>
          <h1 className="mt-4 font-display text-[2rem] leading-tight font-bold md:text-5xl">
            Kebaikan kecil, dampak yang nyata.
          </h1>
          {/* LB §7 alternatif A; "hitungan detik" dipertahankan (keputusan PM 11 Nov 2026). */}
          <p className="mt-3 max-w-md text-white/75">
            Donasi dalam hitungan detik, tanpa wajib daftar. Kuitansi terbit otomatis dan rincian
            penggunaan dana bisa kamu lihat di setiap program.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={featured ? `/campaign/${featured.slug}` : "/campaign"}
              data-track-cta="primary"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 bg-brand-orange px-5 text-ink hover:bg-brand-yellow",
              )}
            >
              Donasi Sekarang
            </Link>
            <Link
              href="/campaign"
              data-track-cta="secondary"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "h-11 px-5 text-white hover:bg-white/10 hover:text-white",
              )}
            >
              Lihat Semua Program <ArrowRight aria-hidden />
            </Link>
          </div>
          <p className="mt-3 text-sm text-white/75">Tanpa wajib daftar · Kuitansi otomatis</p>
        </div>
        {featured ? (
          <div data-track-section="featured">
            <Link
              href={`/campaign/${featured.slug}`}
              className="block overflow-hidden rounded-2xl bg-surface text-ink shadow-lift"
            >
              <div className="relative aspect-[16/8] w-full bg-primary-soft">
                <Image
                  src={featured.imageUrl}
                  alt={featured.imageAlt}
                  fill
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                  unoptimized={featured.imageUrl.endsWith(".svg")}
                  className="object-cover"
                />
              </div>
              <div className="p-4">
                <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                  Program Pilihan
                </span>
                <h2 className="mt-2 leading-snug font-semibold">{featured.title}</h2>
                <div className="mt-3">
                  <FundProgress
                    collected={featured.collectedAmount}
                    target={featured.targetAmount}
                  />
                </div>
              </div>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** S2 — strip statistik (data dari getPlatformStats, cached). */
export function TrustStripView({ stats }: { stats: PlatformStats }) {
  // LP-AC-05: tanpa donasi paid (di bawah ambang) → fakta produk statis, bukan angka nol.
  if (!showPlatformStats(stats.paidDonations)) {
    const icons = [HeartHandshake, ReceiptText, FileText];
    return (
      <section
        data-section="s2"
        aria-label="Keunggulan platform"
        className="relative mx-auto -mt-5 max-w-6xl px-4"
      >
        <ul className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface py-4 shadow-card">
          {STATIC_TRUST_FACTS.map((label, i) => {
            const Icon = icons[i] ?? BadgeCheck;
            return (
              <li key={label} className="flex min-w-0 flex-col items-center gap-1 px-2 text-center">
                <Icon className="size-5 text-gold" aria-hidden />
                <span className="text-[13px] font-semibold break-words sm:text-base">{label}</span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  const items = [
    { icon: HandCoins, value: formatRupiah(stats.collectedAmount), label: "Terkumpul" },
    { icon: Users, value: countFormatter.format(stats.paidDonations), label: "Donasi" },
    { icon: FileText, value: countFormatter.format(stats.publishedNews), label: "Laporan" },
  ];
  return (
    <section
      data-section="s2"
      aria-label="Statistik platform"
      className="relative mx-auto -mt-5 max-w-6xl px-4"
    >
      <dl className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface py-4 shadow-card">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex min-w-0 flex-col items-center px-2 text-center">
            <Icon className="size-5 text-gold" aria-hidden />
            <dt className="order-last text-xs text-ink-faint">{label}</dt>
            <dd className="mt-1 max-w-full text-[13px] font-bold break-words tabular sm:text-lg">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// S4 — LB §10 (alur nyata). "Semua program diverifikasi tim kami sebelum tayang." dipertahankan
// (keputusan PM 11 Nov 2026). Metode pembayaran tidak disebut sampai metode produksi ditetapkan.
const STEPS = [
  {
    icon: HeartHandshake,
    t: "Pilih program",
    d: "Lihat cerita, target, dan progres dana. Semua program diverifikasi tim kami sebelum tayang.",
  },
  {
    icon: PenLine,
    t: "Isi nominal & data",
    d: "Pilih nominal yang disarankan atau isi sendiri, lalu isi nama, email, dan WhatsApp (opsional). Bisa sebagai tamu atau masuk dengan Google. Centang \u201cHamba Allah\u201d bila tidak ingin namamu tampil. Boleh menitipkan doa.",
  },
  {
    icon: CreditCard,
    t: "Bayar",
    d: "Pilih metode pembayaran yang tersedia dan ikuti instruksinya.",
  },
  {
    icon: ShieldCheck,
    t: "Status terkonfirmasi",
    d: "Halaman transaksi diperbarui begitu penyedia pembayaran mengonfirmasi.",
  },
  {
    icon: ReceiptText,
    t: "Terima kuitansi",
    d: "Kuitansi PDF dikirim ke email dan bisa diunduh dari halaman transaksi (7 hari) atau dari akun kapan saja.",
  },
];

export function HowItWorks() {
  return (
    <section
      data-section="s4"
      aria-labelledby="cara-berdonasi"
      className="mx-auto mt-12 max-w-6xl px-4"
    >
      <h2 id="cara-berdonasi" className="text-xl font-bold">
        Cara berdonasi
      </h2>
      <ol className="mt-4 grid gap-5 rounded-2xl border border-border bg-surface p-6 md:grid-cols-2 md:p-8 lg:grid-cols-5">
        {STEPS.map(({ icon: Icon, t, d }, i) => (
          <li key={t} className="flex gap-4 lg:flex-col lg:gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-gold">Langkah {i + 1}</p>
              <p className="font-semibold">{t}</p>
              <p className="mt-1 text-sm text-ink-faint">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// S5 — LB §13. Ilustrasi tanpa angka (LP-AC-04), berlabel "Contoh tampilan".
const FUND_ROWS = [
  { label: "Dana terkumpul", w: "w-full" },
  { label: "Disalurkan ke program", w: "w-4/5" },
  { label: "Biaya operasional", w: "w-1/6" },
  { label: "Biaya transaksi bank/gateway", w: "w-1/12" },
  { label: "Dana tersedia", w: "w-1/4" },
];

export function TransparencySection() {
  return (
    <section
      data-section="s5"
      aria-labelledby="transparansi"
      className="mx-auto mt-12 max-w-6xl px-4"
    >
      <div className="grid gap-6 rounded-2xl bg-primary-soft/60 p-6 md:grid-cols-2 md:items-center md:p-8">
        <div>
          <h2 id="transparansi" className="text-xl font-bold md:text-2xl">
            Ke mana donasimu pergi, bisa kamu lihat.
          </h2>
          <p className="mt-3 text-ink-soft">
            Di setiap halaman program ada{" "}
            <strong className="font-semibold text-ink">Rincian penggunaan dana</strong>: dana
            terkumpul, disalurkan ke program, biaya operasional, biaya transaksi bank/gateway, dan
            dana tersedia. Setiap penyaluran dilengkapi{" "}
            <strong className="font-semibold text-ink">kabar terbaru</strong> beserta buktinya.
          </p>
          {OPERATIONAL_FEE_SENTENCE ? (
            <p className="mt-3 text-ink-soft">{OPERATIONAL_FEE_SENTENCE}</p>
          ) : null}
        </div>
        <figure className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <figcaption className="flex items-center justify-between gap-3">
            <span className="font-bold">Rincian penggunaan dana</span>
            <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-ink">
              Contoh tampilan
            </span>
          </figcaption>
          <ul
            className="mt-4 space-y-3 text-sm"
            aria-label="Contoh tampilan rincian penggunaan dana"
          >
            {FUND_ROWS.map((r) => (
              <li key={r.label}>
                <span className="text-ink-soft">{r.label}</span>
                <span className="mt-1 block h-2 rounded-full bg-muted" aria-hidden>
                  <span className={cn("block h-2 rounded-full bg-primary", r.w)} />
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </section>
  );
}

// S6 — LB §9: hanya elemen yang bisa dibuktikan. Blok legalitas menunggu OD-02 (LP-AC-09).
const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    t: "Pembayaran via Midtrans",
    d: "Pembayaran diproses oleh Midtrans. Status pembayaran dikonfirmasi langsung oleh penyedia pembayaran.",
  },
  {
    icon: FileText,
    t: "Rincian & kabar penyaluran",
    d: "Rincian penggunaan dana dan kabar penyaluran tampil di halaman setiap program.",
  },
  {
    icon: BadgeCheck,
    t: "Kuitansi otomatis",
    d: "Kuitansi PDF bernomor terbit otomatis setelah pembayaran terkonfirmasi, dikirim ke email dan bisa diunduh.",
  },
  {
    icon: Lock,
    t: "Data kamu terjaga",
    d: "Kami tidak pernah meminta PIN, OTP, atau password kamu.",
  },
];

export function TrustSection() {
  return (
    <section
      data-section="s6"
      aria-labelledby="kepercayaan"
      className="mx-auto mt-12 max-w-6xl px-4"
    >
      <h2 id="kepercayaan" className="text-xl font-bold">
        Donasi yang mudah, tercatat, dan bisa kamu pantau.
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_ITEMS.map(({ icon: Icon, t, d }) => (
          <li key={t} className="rounded-2xl border border-border bg-surface p-5">
            <Icon className="size-6 text-primary" aria-hidden />
            <p className="mt-3 font-semibold">{t}</p>
            <p className="mt-1 text-sm text-ink-faint">{d}</p>
          </li>
        ))}
      </ul>
      {LEGALITY_BLOCK ? (
        <div
          data-testid="legality-block"
          className="mt-4 rounded-2xl border border-border bg-surface p-5"
        >
          <p className="font-semibold">{LEGALITY_BLOCK.title}</p>
          <p className="mt-1 text-sm text-ink-faint">{LEGALITY_BLOCK.body}</p>
        </div>
      ) : null}
    </section>
  );
}

// S7 — LB §14. Satu sumber untuk UI & JSON-LD (LP-AC-07); native <details>, tanpa JS.
export function FaqSection({ entries }: { entries: { question: string; answer: string }[] }) {
  return (
    <section data-section="s7" aria-labelledby="faq" className="mx-auto mt-12 max-w-3xl px-4">
      <h2 id="faq" className="text-xl font-bold">
        Pertanyaan yang sering diajukan
      </h2>
      <div
        className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface"
        data-testid="faq"
      >
        {entries.map((e) => (
          <details key={e.question} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              <h3 className="font-semibold">{e.question}</h3>
              <ChevronDown
                className="size-5 shrink-0 transition group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="px-5 pb-4 text-sm leading-relaxed text-ink-soft">{e.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// S8 — LB §8 CTA penutup.
export function ClosingCta() {
  return (
    <section
      data-section="s8"
      aria-label="Ajakan berdonasi"
      className="mx-auto mt-12 max-w-6xl px-4"
    >
      <div className="relative overflow-hidden rounded-2xl bg-primary-ink px-6 py-10 text-center text-white">
        <div className="absolute inset-0 pattern-islamic" aria-hidden />
        <p className="relative mx-auto max-w-md text-white/80">
          Pilih program, isi nominal, bayar. Tanpa wajib akun.
        </p>
        <Link
          href="/campaign"
          className={cn(
            buttonVariants({ size: "lg" }),
            "relative mt-5 h-11 bg-brand-orange px-5 text-ink hover:bg-brand-yellow",
          )}
        >
          Pilih Program Kebaikan <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}
