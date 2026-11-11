import { ArrowRight, BadgeCheck, FileText, HandCoins, HeartHandshake, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CampaignCard } from "@/components/public/campaign-card";
import { CampaignList } from "@/components/public/campaign-list";
import { CampaignListSkeleton } from "@/components/public/campaign-list-skeleton";
import { CategoryChips } from "@/components/public/category-chips";
import { EmptyState } from "@/components/public/empty-state";
import { JsonLd } from "@/components/public/json-ld";
import { FundProgress } from "@/components/public/fund-progress";
import { buttonVariants } from "@/components/ui/button";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";
import { organizationJsonLd } from "@/lib/json-ld";
import { DEFAULT_OG_IMAGE, SITE_NAME, siteUrl } from "@/lib/site";
import { parseCategoryParam } from "@/lib/validation/campaign-list";
import {
  getCampaignPage,
  getFeaturedCampaign,
  getPlatformStats,
  getPublicCategories,
  getUrgentCampaigns,
} from "@/server/queries/public-campaigns";

export const metadata: Metadata = {
  title: "Tebar Kebaikan — Donasi & Sedekah Online yang Amanah",
  description:
    "Donasi dan sedekah online dalam hitungan detik tanpa perlu daftar. Pilih program pendidikan, masjid, yatim & dhuafa, hingga kemanusiaan — setiap rupiah tercatat dan dilaporkan.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Tebar Kebaikan — Donasi & Sedekah Online yang Amanah",
    description:
      "Donasi dalam hitungan detik tanpa perlu daftar. Setiap rupiah tercatat dan penyalurannya dilaporkan.",
    images: [DEFAULT_OG_IMAGE],
  },
};

const countFormatter = new Intl.NumberFormat("id-ID");

async function Hero() {
  const featured = await getFeaturedCampaign();
  return (
    <section className="relative overflow-hidden bg-primary-ink text-white">
      <div className="pattern-islamic absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-8 pb-10 md:grid-cols-2 md:items-center md:py-16">
        <div>
          <span className="inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-gold-soft">
            #TebarKebaikan
          </span>
          <h1 className="mt-4 font-display text-[2rem] leading-tight font-bold md:text-5xl">
            Kebaikan kecil, dampak yang nyata.
          </h1>
          <p className="mt-3 max-w-md text-white/75">
            Donasi dalam hitungan detik — tanpa perlu daftar. Setiap rupiah tercatat dan
            penyalurannya dilaporkan.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={featured ? `/campaign/${featured.slug}` : "/campaign"}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 bg-brand-orange px-5 text-ink hover:bg-brand-yellow",
              )}
            >
              Donasi Sekarang
            </Link>
            <Link
              href="/campaign"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "h-11 px-5 text-white hover:bg-white/10 hover:text-white",
              )}
            >
              Lihat Program <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
        {featured ? (
          <Link
            href={`/campaign/${featured.slug}`}
            className="overflow-hidden rounded-2xl bg-surface text-ink shadow-lift"
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
                <FundProgress collected={featured.collectedAmount} target={featured.targetAmount} />
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

async function TrustStrip() {
  const stats = await getPlatformStats();
  const items = [
    { icon: HandCoins, value: formatRupiah(stats.collectedAmount), label: "Terkumpul" },
    { icon: Users, value: countFormatter.format(stats.paidDonations), label: "Donasi" },
    { icon: FileText, value: countFormatter.format(stats.publishedNews), label: "Laporan" },
  ];
  return (
    <section aria-label="Statistik platform" className="relative mx-auto -mt-5 max-w-6xl px-4">
      <dl className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface py-4 shadow-card">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex min-w-0 flex-col items-center px-2 text-center">
            <Icon className="size-5 text-gold" aria-hidden />
            <dt className="order-last text-xs text-ink-faint">{label}</dt>
            <dd className="tabular mt-1 max-w-full text-[13px] font-bold break-words sm:text-lg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function UrgentRow() {
  const urgent = await getUrgentCampaigns(3);
  if (urgent.length === 0) return null;
  return (
    <section className="mx-auto mt-10 max-w-6xl px-4">
      <h2 className="text-xl font-bold">Butuh bantuan segera</h2>
      <p className="text-sm text-ink-faint">Program dengan tenggat terdekat</p>
      <ul className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
        {urgent.map((c) => (
          <li key={c.id} className="w-72 shrink-0 snap-start md:w-auto">
            <CampaignCard c={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function ProgramList({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [params, categories] = await Promise.all([searchParams, getPublicCategories()]);
  const kategori = parseCategoryParam(
    params.kategori,
    categories.map((c) => c.slug),
  );
  const page = await getCampaignPage({ status: "published", categorySlug: kategori });
  return (
    <>
      <div className="mt-4">
        <CategoryChips categories={categories} active={kategori} basePath="/" />
      </div>
      <div className="mt-5">
        {page.items.length === 0 ? (
          <EmptyState
            icon={HeartHandshake}
            title="Belum ada program di kategori ini"
            description="Program kebaikan baru segera hadir. Coba lihat kategori lain."
            action={
              kategori ? (
                <Link href="/" scroll={false} className={buttonVariants({ variant: "outline" })}>
                  Lihat semua program
                </Link>
              ) : undefined
            }
          />
        ) : (
          <CampaignList
            key={kategori ?? "semua"}
            initialItems={page.items}
            initialCursor={page.nextCursor}
            kategori={kategori}
          />
        )}
      </div>
    </>
  );
}

const STEPS = [
  { icon: HeartHandshake, t: "Pilih program", d: "Semua program diverifikasi tim kami sebelum tayang." },
  { icon: ShieldCheck, t: "Bayar dengan aman", d: "QRIS, e-wallet, atau virtual account. Tanpa perlu membuat akun." },
  { icon: BadgeCheck, t: "Pantau penyaluran", d: "Kuitansi otomatis dan kabar penyaluran langsung ke email/WhatsApp." },
];

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <JsonLd data={organizationJsonLd(siteUrl(), SITE_NAME)} />
      <Hero />
      <TrustStrip />
      <UrgentRow />
      <section id="program" className="mx-auto mt-10 max-w-6xl scroll-mt-20 px-4">
        <h2 className="text-xl font-bold">Pilih program kebaikan</h2>
        <Suspense fallback={<div className="mt-5"><CampaignListSkeleton /></div>}>
          <ProgramList searchParams={searchParams} />
        </Suspense>
      </section>
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <ol className="grid gap-4 rounded-2xl border border-border bg-surface p-6 md:grid-cols-3 md:p-8">
          {STEPS.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="flex gap-4">
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
    </>
  );
}
