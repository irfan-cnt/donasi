import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ChartColumn,
  Check,
  ChevronDown,
  CircleCheckBig,
  CreditCard,
  FileCheck,
  FileText,
  HandCoins,
  HandHeart,
  Heart,
  HeartHandshake,
  Lock,
  MessageCircle,
  Newspaper,
  PenLine,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { DaysLabel } from "@/components/public/campaign-card";
import { LandingCampaignCard } from "@/components/public/landing-campaign-card";
import {
  LP_EYEBROW,
  LP_EYEBROW_DARK,
  LP_H2,
  LP_SEC,
  LP_SUB,
  LP_WRAP,
  lpButton,
} from "@/components/public/landing-ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LEGALITY_BLOCK,
  OPERATIONAL_FEE_SENTENCE,
  STATIC_TRUST_FACTS,
  showPlatformStats,
} from "@/lib/landing";
import { formatRupiah, progressPercent } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CampaignCardData, PlatformStats } from "@/server/queries/public-campaigns";

// Section landing page `/` (P30, marketing/landing-page-implementation-brief.md S1–S8) dengan
// tampilan desain "Beranda — TebarKebaikan" (Nov 2026). Server Component murni (tanpa JS klien);
// data dari page.tsx (query cached). Angka hanya dari DB — bagian desain yang berisi data
// demonstrasi (transparansi) ditampilkan sebagai contoh tampilan tanpa angka (LP-AC-04).

const countFormatter = new Intl.NumberFormat("id-ID");

const HERO_TRUST = [
  "Tanpa wajib daftar akun",
  "Kuitansi otomatis via email",
  "Rincian penyaluran terbuka",
];

/**
 * S1 — Hero. Foto & kartu melayang memakai program pilihan; tanpa program pilihan panel foto
 * diganti motif dan CTA primer ke /campaign. `donations` = jumlah donasi terkonfirmasi
 * (hanya dikirim bila melewati ambang LP-AC-05).
 */
export function HeroView({
  featured,
  donations,
}: {
  featured: CampaignCardData | null;
  donations?: number;
}) {
  const pct =
    featured?.targetAmount != null
      ? progressPercent(featured.collectedAmount, featured.targetAmount)
      : null;
  return (
    <section
      id="beranda"
      data-section="s1"
      aria-labelledby="hero-title"
      className="lp-dark relative scroll-mt-[72px] overflow-hidden bg-primary-ink pt-11 pb-32 text-white sm:pt-16 sm:pb-[148px] lg:pt-20 lg:pb-[156px]"
    >
      <div
        aria-hidden
        className="lp-geo pointer-events-none absolute inset-y-0 right-0 w-[62%] [mask-image:linear-gradient(90deg,transparent,#000_45%)]"
      />
      <div
        className={cn(
          LP_WRAP,
          "relative grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:gap-16",
        )}
      >
        <div>
          <span className={LP_EYEBROW_DARK}>
            #TebarKebaikan · Platform donasi amanah &amp; transparan
          </span>
          <h1
            id="hero-title"
            className="mt-6 text-[clamp(38px,5vw,64px)] leading-[1.05] font-extrabold tracking-[-0.035em] max-[380px]:text-[33px] 2xl:text-[68px]"
          >
            Kebaikan kecil <em className="text-brand-yellow not-italic">berdampak Besar</em> untuk
            sesama
          </h1>
          <p className="mt-6 max-w-[540px] text-base leading-[1.7] text-[#CFE0D5] sm:text-lg">
            Setiap kebaikan yang kamu titipkan menjadi harapan baru bagi mereka yang membutuhkan.
            Bersama Tebar Kebaikan, mari hadirkan perubahan nyata.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={featured ? `/campaign/${featured.slug}` : "/campaign"}
              data-track-cta="primary"
              className={lpButton("orange", "lg", "max-sm:w-full")}
            >
              Mulai Berdonasi <ArrowRight aria-hidden />
            </Link>
            <Link
              href="/campaign"
              data-track-cta="secondary"
              className={lpButton("ghost", "lg", "max-sm:w-full")}
            >
              Jelajahi Program
            </Link>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-[18px] gap-y-2 text-[13px] font-medium text-[#D5E5DA]">
            {HERO_TRUST.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="size-4 shrink-0 text-brand-yellow" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none lg:pl-7">
          <div
            aria-hidden
            className="absolute -top-[22px] -right-[22px] hidden size-[132px] rounded-full border-2 border-dashed border-[rgba(251,191,36,.55)] sm:block"
          />
          <div className="relative flex aspect-[4/3.4] items-center justify-center overflow-hidden rounded-[22px] border border-white/15 bg-[#0B5A35] sm:aspect-[16/12] sm:rounded-[28px] lg:aspect-[1/1.08]">
            {featured ? (
              <Image
                src={featured.imageUrl}
                alt={featured.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 46vw, (min-width: 640px) 560px, 100vw"
                unoptimized={featured.imageUrl.endsWith(".svg")}
                className="object-cover"
              />
            ) : (
              <>
                <div aria-hidden className="lp-geo-sm absolute inset-0" />
                <span className="relative flex size-24 items-center justify-center rounded-[28px] bg-white/[0.08] text-brand-yellow">
                  <HandHeart className="size-12" strokeWidth={1.5} aria-hidden />
                </span>
              </>
            )}
          </div>

          {donations ? (
            <div className="absolute top-3 right-2.5 flex items-center gap-3 rounded-[20px] bg-white py-2.5 pr-3.5 pl-2.5 text-ink shadow-[0_28px_56px_-24px_rgba(0,0,0,.55)] max-[380px]:hidden sm:top-12 sm:-right-3.5 sm:animate-lp-bob sm:py-3.5 sm:pr-[18px] sm:pl-3.5 sm:[animation-delay:-3.5s] motion-reduce:animate-none">
              <span className="flex size-[42px] items-center justify-center rounded-xl bg-gold-soft text-gold">
                <HandCoins className="size-5" aria-hidden />
              </span>
              <div>
                <strong className="block text-[15px] leading-[1.2]">
                  {countFormatter.format(donations)} donasi
                </strong>
                <span className="text-[12.5px] text-ink-faint">sudah terkumpul bersama</span>
              </div>
            </div>
          ) : null}

          {featured ? (
            <div
              data-track-section="featured"
              className="relative mx-3 -mt-14 flex flex-col gap-3 rounded-[20px] bg-white p-[18px] text-ink shadow-[0_28px_56px_-24px_rgba(0,0,0,.55)] max-[380px]:mx-2 max-[380px]:-mt-11 max-[380px]:p-4 sm:absolute sm:bottom-8 sm:left-0 sm:mx-0 sm:mt-0 sm:w-80 sm:animate-lp-bob motion-reduce:animate-none"
            >
              <div>
                <span className="inline-flex rounded-full bg-gold-soft px-2.5 py-1 text-[11.5px] font-bold tracking-[0.04em] text-[#8A4B00] uppercase">
                  Program pilihan
                </span>
              </div>
              <Link
                href={`/campaign/${featured.slug}`}
                className="text-[15px] leading-[1.35] font-bold text-ink transition-colors hover:text-primary"
              >
                {featured.title}
              </Link>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full", pct === null ? "lp-bar-open" : "bg-primary")}
                  style={{ width: pct === null ? "100%" : `${pct}%` }}
                />
              </div>
              <div className="flex justify-between gap-2 text-[13px] text-[#4F5750]">
                <span>
                  <strong className="tabular text-[15px] text-primary">
                    {formatRupiah(featured.collectedAmount)}
                  </strong>{" "}
                  terkumpul
                </span>
                <span className="text-right">
                  {pct === null ? "Tanpa target" : `${pct}%`} · <DaysLabel c={featured} />
                </span>
              </div>
              <Link href={`/donasi/${featured.slug}`} className={lpButton("green", "sm", "w-full")}>
                Donasi untuk program ini
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const STAT_CELL =
  "flex flex-col items-center justify-center gap-2.5 border-[#EEF1ED] px-3.5 py-[18px] text-center max-sm:[&+li]:border-t sm:gap-3.5 sm:px-[22px] sm:pt-[22px] sm:pb-[26px] sm:[&+li]:border-l";
const STAT_ICON =
  "flex size-[46px] shrink-0 items-center justify-center rounded-[14px] bg-primary-soft text-primary";

/** S2 — kartu statistik yang menumpuk di atas hero (data dari getPlatformStats, cached). */
export function TrustStripView({ stats }: { stats: PlatformStats }) {
  // LP-AC-05: tanpa donasi paid (di bawah ambang) → fakta produk statis, bukan angka nol.
  const showStats = showPlatformStats(stats.paidDonations);
  const factIcons = [HeartHandshake, ReceiptText, FileText];
  const items = showStats
    ? [
        {
          icon: Wallet,
          value: formatRupiah(stats.collectedAmount),
          label: "Total donasi terkumpul",
        },
        { icon: HandCoins, value: countFormatter.format(stats.paidDonations), label: "Donasi" },
        {
          icon: FileText,
          value: countFormatter.format(stats.publishedNews),
          label: "Laporan penyaluran",
        },
      ]
    : STATIC_TRUST_FACTS.map((label, i) => ({
        icon: factIcons[i] ?? BadgeCheck,
        value: null,
        label,
      }));
  return (
    <section
      id="dampak"
      data-section="s2"
      aria-label={showStats ? "Statistik platform" : "Keunggulan platform"}
      className="relative z-[3] -mt-[88px] scroll-mt-24 sm:-mt-24"
    >
      <div className={LP_WRAP}>
        <ul className="grid rounded-3xl border border-border bg-white p-2.5 shadow-[0_34px_64px_-44px_rgba(6,68,38,.55)] sm:grid-cols-3">
          {items.map(({ icon: Icon, value, label }) => (
            <li key={label} className={STAT_CELL}>
              <span className={STAT_ICON}>
                <Icon className="size-[22px]" aria-hidden />
              </span>
              {value === null ? (
                <p className="text-base leading-snug font-bold sm:text-lg">{label}</p>
              ) : (
                <div className="max-w-full min-w-0">
                  <p className="tabular text-[23px] leading-[1.1] font-extrabold tracking-[-0.025em] break-words sm:text-[clamp(20px,2.2vw,26px)]">
                    {value}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink-faint">{label}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** S3a — "Butuh Bantuan Segera": rel geser di tablet/ponsel, kisi tiga kolom di desktop. */
export function UrgentSection({ items }: { items: CampaignCardData[] }) {
  if (items.length === 0) return null;
  return (
    <section
      id="mendesak"
      data-section="s3"
      data-track-section="urgent"
      aria-labelledby="urg-title"
      className={LP_SEC}
    >
      <div className={LP_WRAP}>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-6 sm:mb-10">
          <div>
            <span className={LP_EYEBROW}>Mendesak</span>
            <h2 id="urg-title" className={LP_H2}>
              Butuh Bantuan Segera
            </h2>
            <p className={LP_SUB}>
              Ulurkan bantuanmu untuk saudara-saudara kita yang membutuhkan.
            </p>
          </div>
          <Link href="/campaign" className={lpButton("line", "md", "max-sm:w-full")}>
            Lihat Semua Program <ArrowRight aria-hidden />
          </Link>
        </div>
        <ul className="-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[86%] grid-flow-col gap-3.5 overflow-x-auto overscroll-x-contain px-4 pt-2 pb-3.5 [scrollbar-color:#C4D9CB_transparent] [scrollbar-width:thin] sm:-mx-8 sm:scroll-px-8 sm:auto-cols-[minmax(300px,calc(50%-12px))] sm:gap-6 sm:px-8 sm:pb-4 lg:mx-0 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-3 lg:overflow-visible lg:p-0">
          {items.map((c) => (
            <li key={c.id} className="snap-start">
              <LandingCampaignCard c={c} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** S3b — "Pilih Program Kebaikan": kepala section; filter & daftar dikirim sebagai children. */
export function ProgramSection({ children }: { children: ReactNode }) {
  return (
    <section
      id="program"
      data-section="s3"
      data-track-section="list"
      aria-labelledby="pilih-program"
      className={cn(LP_SEC, "border-y border-[#EEF1ED] bg-white")}
    >
      <div className={LP_WRAP}>
        <div className="mb-7 sm:mb-10">
          <span className={LP_EYEBROW}>Program donasi</span>
          <h2 id="pilih-program" className={LP_H2}>
            Pilih Program Kebaikan
          </h2>
          <p className={LP_SUB}>
            Saring per kategori, lalu pilih program yang ingin kamu dukung.
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

/** Kerangka muat daftar program (bentuk kartu desain). */
export function ProgramSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat program">
      <div className="flex gap-1.5 pt-1 pb-2.5">
        {["w-24", "w-32", "w-28"].map((w) => (
          <Skeleton key={w} className={cn("h-11 rounded-full", w)} />
        ))}
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c"].map((k) => (
          <div key={k} className="overflow-hidden rounded-[20px] border border-border bg-white">
            <Skeleton className="aspect-[16/10] rounded-none" />
            <div className="grid gap-3 p-5">
              <Skeleton className="h-5 w-[85%]" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="mt-3.5 h-2 w-full" />
              <Skeleton className="mt-2 h-12 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// S4 — alur nyata. "Semua program diverifikasi tim kami sebelum tayang." dan "hitungan detik"
// dipertahankan (keputusan PM 11 Nov 2026). Metode pembayaran tidak disebut sampai metode
// produksi ditetapkan.
const STEPS = [
  {
    icon: Heart,
    t: "Pilih Program",
    d: "Baca cerita, target, dan progres dana. Semua program diverifikasi tim kami sebelum tayang.",
  },
  {
    icon: PenLine,
    t: "Isi Nominal dan Data",
    d: "Pilih nominal, isi nama, email, dan WhatsApp (opsional). Bisa tampil sebagai “Hamba Allah”.",
  },
  {
    icon: CreditCard,
    t: "Lakukan Pembayaran",
    d: "Pilih metode pembayaran yang tersedia dan ikuti instruksinya. Status diperbarui otomatis.",
  },
  {
    icon: FileCheck,
    t: "Terima Bukti Transaksi",
    d: "Kuitansi PDF bernomor dikirim ke email dan bisa diunduh dari halaman transaksi.",
  },
  {
    icon: ChartColumn,
    t: "Pantau Penyaluran",
    d: "Lihat rincian penggunaan dana dan kabar penyaluran terbaru di halaman program.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="cara-donasi"
      data-section="s4"
      aria-labelledby="cara-berdonasi"
      className={LP_SEC}
    >
      <div className={LP_WRAP}>
        <div className="mb-7 flex flex-col items-center text-center sm:mb-10">
          <span className={LP_EYEBROW}>Cara berdonasi</span>
          <h2 id="cara-berdonasi" className={LP_H2}>
            Berbuat Baik Kini Lebih Mudah
          </h2>
          <p className={cn(LP_SUB, "mx-auto")}>
            Donasi dalam hitungan detik: lima langkah sederhana dari memilih program sampai
            memantau penyalurannya — tanpa wajib membuat akun.
          </p>
        </div>
        <ol className="relative mx-auto grid max-w-[640px] gap-7 before:absolute before:top-8 before:bottom-8 before:left-[31px] before:border-l-2 before:border-dashed before:border-[#C4D9CB] before:content-[''] lg:max-w-none lg:grid-cols-5 lg:gap-6 lg:before:right-[10%] lg:before:bottom-auto lg:before:left-[10%] lg:before:border-t-2 lg:before:border-l-0">
          {STEPS.map(({ icon: Icon, t, d }, i) => (
            <li
              key={t}
              className="group relative flex items-start gap-[22px] lg:flex-col lg:items-center lg:gap-[18px] lg:text-center"
            >
              <span className="relative flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-primary text-white shadow-[0_0_0_8px_rgb(var(--tk-bg))] transition-transform duration-[250ms] group-hover:-translate-y-[3px] group-hover:-rotate-[4deg] motion-reduce:transform-none">
                <Icon className="size-[26px]" aria-hidden />
                <span className="absolute -top-[9px] -right-[9px] flex size-7 items-center justify-center rounded-full border-[3px] border-bg bg-brand-orange text-xs font-extrabold text-[#2A1B00]">
                  {i + 1}
                </span>
              </span>
              <div>
                <h3 className="text-[17px] font-bold tracking-[-0.01em]">{t}</h3>
                <p className="mt-1.5 text-sm leading-[1.6] text-ink-faint">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// S5 — Transparansi. Desain memuat angka demonstrasi; di produksi bagian ini ilustrasi TANPA
// angka (LP-AC-04); badge "Contoh tampilan" dihapus atas permintaan PM (11 Nov 2026). Angka
// sebenarnya ada di halaman tiap program.
const FUND_ROWS = [
  {
    color: "bg-ink",
    label: "Dana terkumpul",
    d: "Seluruh donasi yang pembayarannya sudah terkonfirmasi.",
    w: "w-full",
  },
  {
    color: "bg-primary",
    label: "Disalurkan ke program",
    d: "Dana yang sudah dipakai untuk kebutuhan program.",
    w: "w-3/5",
  },
  {
    color: "bg-brand-orange",
    label: "Biaya operasional & transaksi",
    d: "Biaya operasional serta biaya transaksi bank/gateway, dicatat terpisah.",
    w: "w-1/6",
  },
  {
    color: "bg-[#9CC9AC]",
    label: "Dana tersedia",
    d: "Sisa dana yang siap disalurkan sesuai rencana program.",
    w: "w-1/4",
  },
];

const REPORT_ROWS = [
  {
    icon: Newspaper,
    t: "Kabar terbaru setiap penyaluran",
    d: "Ditulis tim kami dan tampil di halaman program.",
  },
  {
    icon: Camera,
    t: "Bukti penyaluran",
    d: "Dokumentasi dilampirkan pada kabar penyaluran.",
  },
  {
    icon: ReceiptText,
    t: "Kuitansi untuk donasimu",
    d: "Kuitansi PDF bernomor terbit setelah pembayaran terkonfirmasi.",
  },
];

const PANEL = "flex flex-col rounded-[22px] border border-[#E1EAE3] bg-white p-[22px] sm:p-7";

export function TransparencySection() {
  return (
    <section
      id="transparansi"
      data-section="s5"
      aria-labelledby="transparansi-title"
      className={cn(LP_SEC, "bg-[#EEF5F0]")}
    >
      <div className={LP_WRAP}>
        <div className="mb-7 sm:mb-10">
          <div>
            <span className={LP_EYEBROW}>Transparansi</span>
            <h2 id="transparansi-title" className={LP_H2}>
              Ke Mana Donasimu Pergi, Bisa Kamu Lihat.
            </h2>
            <p className={LP_SUB}>
              Setiap halaman program menampilkan{" "}
              <strong className="font-semibold text-ink">rincian penggunaan dana</strong> —
              terkumpul, disalurkan ke program, biaya operasional, biaya transaksi bank/gateway,
              dan dana tersedia — lengkap dengan{" "}
              <strong className="font-semibold text-ink">kabar penyaluran</strong> beserta
              buktinya.
            </p>
            {OPERATIONAL_FEE_SENTENCE ? (
              <p className={LP_SUB}>{OPERATIONAL_FEE_SENTENCE}</p>
            ) : null}
          </div>
        </div>

        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Contoh tampilan rincian penggunaan dana"
        >
          {FUND_ROWS.map((r) => (
            <li
              key={r.label}
              className="rounded-[18px] border border-[#E1EAE3] bg-white px-5 py-[18px] sm:p-[22px]"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-[#4F5750]">
                <span className={cn("size-3 shrink-0 rounded", r.color)} aria-hidden />
                {r.label}
              </p>
              <span className="mt-4 block h-2.5 rounded-full bg-muted" aria-hidden>
                <span className={cn("block h-full rounded-full", r.color, r.w)} />
              </span>
              <p className="mt-3 text-[13px] text-ink-faint">{r.d}</p>
            </li>
          ))}
        </ul>

        <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className={PANEL}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold tracking-[-0.01em]">Rincian penggunaan dana</h3>
              <span className="text-[13px] text-ink-faint">Di setiap halaman program</span>
            </div>
            <div className="mt-6 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
              <div className="relative size-[168px] shrink-0" aria-hidden>
                <svg width="168" height="168" viewBox="0 0 168 168">
                  <circle cx="84" cy="84" r="70" fill="none" stroke="#E3ECE5" strokeWidth="16" />
                  <circle
                    cx="84"
                    cy="84"
                    r="70"
                    fill="none"
                    stroke="#075C32"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="264 440"
                    transform="rotate(-90 84 84)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-primary">
                  <HandCoins className="size-9" strokeWidth={1.75} />
                  <span className="mt-1.5 text-[13px] text-ink-faint">tersalurkan</span>
                </div>
              </div>
              <p className="text-[15px] leading-[1.65] text-ink-soft">
                Kamu bisa melihat berapa dana yang{" "}
                <strong className="text-primary">terkumpul</strong>, berapa yang sudah{" "}
                <strong className="text-primary">disalurkan</strong>, dan berapa yang masih
                tersedia. Rincian diperbarui setiap ada penyaluran.
              </p>
            </div>
            <div className="mt-7 flex h-3.5 gap-[3px] overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="h-full w-3/5 bg-primary" />
              <span className="h-full w-[15%] bg-brand-orange" />
              <span className="h-full w-1/4 bg-[#9CC9AC]" />
            </div>
            <ul className="mt-[18px] grid gap-2.5 text-sm text-ink-soft">
              {FUND_ROWS.slice(1).map((r) => (
                <li key={r.label} className="flex items-center gap-2.5">
                  <span className={cn("size-3 shrink-0 rounded", r.color)} aria-hidden />
                  {r.label}
                </li>
              ))}
            </ul>
          </div>

          <div className={PANEL}>
            <h3 className="text-lg font-extrabold tracking-[-0.01em]">Kabar penyaluran</h3>
            <ul className="mt-3 mb-[22px]">
              {REPORT_ROWS.map(({ icon: Icon, t, d }) => (
                <li
                  key={t}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 border-[#F0F2EE] py-4 [&+li]:border-t"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[15px] leading-[1.35] font-bold">{t}</p>
                    <p className="mt-0.5 text-[13px] text-ink-faint">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/campaign" className={lpButton("green", "md", "mt-auto self-start")}>
              Lihat Program &amp; Rinciannya <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// S6 — hanya elemen yang bisa dibuktikan. Blok legalitas menunggu OD-02 (LP-AC-09).
const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    t: "Pembayaran Aman",
    d: "Transaksi diproses oleh Midtrans. Status pembayaran dikonfirmasi langsung oleh penyedia pembayaran.",
  },
  {
    icon: FileText,
    t: "Rincian & Bukti Penyaluran",
    d: "Rincian penggunaan dana dan kabar penyaluran beserta buktinya tampil di setiap halaman program.",
  },
  {
    icon: CircleCheckBig,
    t: "Konfirmasi Otomatis",
    d: "Kuitansi PDF bernomor terbit otomatis setelah pembayaran terkonfirmasi, dikirim ke email dan bisa diunduh.",
  },
  {
    icon: Lock,
    t: "Data Donatur Terjaga",
    d: "Isi data seperlunya dan sembunyikan namamu bila mau. Kami tidak pernah meminta PIN, OTP, atau password kamu.",
  },
];

export function TrustSection() {
  return (
    <section id="tentang" data-section="s6" aria-labelledby="kepercayaan" className={LP_SEC}>
      <div className={LP_WRAP}>
        <div className="mb-12 grid items-end gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-14">
          <div>
            <span className={LP_EYEBROW}>Tentang kami</span>
            <h2 id="kepercayaan" className={LP_H2}>
              Donasi yang Mudah, Tercatat, dan Bisa Kamu Pantau.
            </h2>
          </div>
          <p className={LP_SUB}>
            Tebar Kebaikan adalah platform donasi yang amanah dan transparan. Setiap rupiah
            tercatat, setiap penyaluran dilaporkan — supaya kamu bisa berbagi dengan tenang.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, t, d }) => (
            <li
              key={t}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 rounded-[20px] border border-border bg-white p-5 transition-[transform,box-shadow,border-color] duration-[250ms] hover:-translate-y-1 hover:border-[#D2E0D6] hover:shadow-[0_24px_44px_-30px_rgba(6,68,38,.5)] motion-reduce:transform-none sm:block sm:p-[26px]"
            >
              <span className="row-span-2 flex size-12 items-center justify-center rounded-[14px] bg-primary-soft text-primary sm:size-[54px] sm:rounded-2xl">
                <Icon className="size-[26px]" aria-hidden />
              </span>
              <h3 className="text-[17px] font-bold tracking-[-0.01em] sm:mt-[22px]">{t}</h3>
              <p className="mt-1 text-sm leading-[1.6] text-ink-faint sm:mt-2">{d}</p>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-[18px] border border-border bg-white p-[18px] sm:flex-row sm:flex-wrap sm:items-center sm:px-6 sm:py-5">
          <div className="flex flex-col items-start gap-2.5 text-[14.5px] text-ink-soft sm:flex-row sm:items-center sm:gap-3.5">
            <span className="rounded-[10px] border border-[#D5DED7] bg-[#FBFCFA] px-3.5 py-2 text-[15px] font-extrabold tracking-[-0.01em] text-ink">
              Midtrans
            </span>
            <span>Pembayaran diproses oleh payment gateway berizin Bank Indonesia.</span>
          </div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#4F5750]">
            <ShieldCheck className="size-[18px] shrink-0 text-primary" aria-hidden />
            Metode pembayaran yang tersedia tampil saat checkout.
          </p>
        </div>
        {LEGALITY_BLOCK ? (
          <div
            data-testid="legality-block"
            className="mt-5 rounded-[18px] border border-border bg-white p-[18px] sm:px-6 sm:py-5"
          >
            <p className="font-bold">{LEGALITY_BLOCK.title}</p>
            <p className="mt-1 text-sm text-ink-faint">{LEGALITY_BLOCK.body}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// S7 — satu sumber untuk UI & JSON-LD (LP-AC-07); native <details>, tanpa JS.
export function FaqSection({ entries }: { entries: { question: string; answer: string }[] }) {
  return (
    <section
      id="faq"
      data-section="s7"
      aria-labelledby="faq-title"
      className={cn(LP_SEC, "border-y border-[#EEF1ED] bg-white")}
    >
      <div
        className={cn(
          LP_WRAP,
          "grid items-start gap-9 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-16",
        )}
      >
        <div className="lg:sticky lg:top-28">
          <span className={LP_EYEBROW}>FAQ</span>
          <h2 id="faq-title" className={LP_H2}>
            Pertanyaan yang Sering Diajukan
          </h2>
          <p className={LP_SUB}>
            Jawaban singkat untuk hal-hal yang paling sering ditanyakan donatur.
          </p>
          <div className="lp-dark mt-8 flex flex-col items-start gap-2.5 rounded-[22px] bg-primary p-[26px] text-white">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.12] text-brand-yellow">
              <MessageCircle className="size-[22px]" aria-hidden />
            </span>
            <h3 className="text-lg font-extrabold">Masih ada pertanyaan?</h3>
            <p className="mb-1.5 text-[14.5px] text-[#D5E5DA]">
              Lihat cara menghubungi tim layanan donatur kami di halaman Kontak.
            </p>
            <Link href="/kontak" className={lpButton("orange", "sm")}>
              Hubungi Kami
            </Link>
          </div>
        </div>
        <div className="grid gap-3" data-testid="faq">
          {entries.map((e) => (
            <details
              key={e.question}
              className="group rounded-2xl border border-border bg-white transition-[border-color,box-shadow] duration-200 open:border-[#BFD6C6] open:shadow-[0_18px_36px_-30px_rgba(6,68,38,.5)] hover:border-[#D2E0D6]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-[22px] py-5 leading-[1.45] transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-[380px]:px-4 max-[380px]:py-[18px] [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-bold max-[380px]:text-[15px]">{e.question}</h3>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F0F4F1] text-primary transition-[transform,background-color] duration-300 group-open:rotate-180 group-open:bg-primary group-open:text-white">
                  <ChevronDown className="size-4" aria-hidden />
                </span>
              </summary>
              <p className="px-[22px] pb-[22px] text-[15px] leading-[1.7] text-[#4F5750] max-[380px]:px-4 max-[380px]:pb-[18px]">
                {e.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// S8 — CTA penutup.
export function ClosingCta() {
  return (
    <section id="ajak" data-section="s8" aria-labelledby="cta-title" className={LP_SEC}>
      <div className={LP_WRAP}>
        <div className="lp-dark relative overflow-hidden rounded-3xl bg-primary-ink px-[22px] py-[60px] text-center text-white sm:rounded-[32px] sm:px-12 sm:py-[88px]">
          <div
            aria-hidden
            className="lp-geo pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_25%,#000_75%)]"
          />
          <div className="relative flex flex-col items-center">
            <span className={LP_EYEBROW_DARK}>Mulai hari ini</span>
            <h2
              id="cta-title"
              className="mt-[22px] max-w-[800px] text-[clamp(28px,3.6vw,46px)] leading-[1.12] font-extrabold tracking-[-0.03em] max-[380px]:text-[26px]"
            >
              Setiap Kebaikan Punya Arti.{" "}
              <em className="text-brand-yellow not-italic">Mari Jadi Bagian dari Perubahan.</em>
            </h2>
            <p className="mt-[18px] max-w-[540px] text-[17px] text-[#CFE0D5]">
              Mulai dari langkah kecil, bersama kita hadirkan manfaat yang lebih besar.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 max-sm:w-full">
              <Link href="/#program" className={lpButton("orange", "lg", "max-sm:w-full")}>
                Pilih Program Kebaikan <ArrowRight aria-hidden />
              </Link>
              <Link href="/campaign" className={lpButton("ghost", "lg", "max-sm:w-full")}>
                Jelajahi Semua Program
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
