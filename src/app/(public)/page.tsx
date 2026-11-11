import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CampaignCard } from "@/components/public/campaign-card";
import { CampaignList } from "@/components/public/campaign-list";
import { CampaignListSkeleton } from "@/components/public/campaign-list-skeleton";
import { CategoryChips } from "@/components/public/category-chips";
import { EmptyState } from "@/components/public/empty-state";
import { JsonLd } from "@/components/public/json-ld";
import {
  ClosingCta,
  FaqSection,
  HeroView,
  HowItWorks,
  TransparencySection,
  TrustSection,
  TrustStripView,
} from "@/components/public/landing-sections";
import { TrackClicks } from "@/components/shared/track-clicks";
import { buttonVariants } from "@/components/ui/button";
import { faqJsonLd, organizationJsonLd } from "@/lib/json-ld";
import { visibleFaq } from "@/lib/landing-faq";
import { SITE_NAME, siteUrl } from "@/lib/site";
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
    // Gambar: src/app/(public)/opengraph-image.tsx (dinamis, tanpa angka statistik).
  },
};

async function Hero() {
  return <HeroView featured={await getFeaturedCampaign()} />;
}

async function TrustStrip() {
  return <TrustStripView stats={await getPlatformStats()} />;
}

async function UrgentRow() {
  const urgent = await getUrgentCampaigns(3);
  if (urgent.length === 0) return null;
  return (
    <section data-section="s3" data-track-section="urgent" className="mx-auto mt-10 max-w-6xl px-4">
      <h2 className="text-xl font-bold">Butuh bantuan segera</h2>
      <p className="text-sm text-ink-faint">Program dengan tenggat terdekat</p>
      <ul className="-mx-4 mt-4 no-scrollbar flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
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
            title={kategori ? "Belum ada program di kategori ini" : "Program kebaikan segera hadir"}
            description={
              kategori
                ? "Program kebaikan baru segera hadir. Coba lihat kategori lain."
                : "Program kebaikan baru segera hadir. Kunjungi kembali halaman ini nanti."
            }
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

export default function HomePage({ searchParams }: PageProps<"/">) {
  const faq = visibleFaq();
  return (
    <>
      <JsonLd data={organizationJsonLd(siteUrl(), SITE_NAME)} />
      <JsonLd data={faqJsonLd(faq)} />
      <TrackClicks />
      <Hero />
      <TrustStrip />
      <UrgentRow />
      <section
        id="program"
        data-section="s3"
        data-track-section="list"
        aria-labelledby="pilih-program"
        className="mx-auto mt-10 max-w-6xl scroll-mt-20 px-4"
      >
        <h2 id="pilih-program" className="text-xl font-bold">
          Pilih program kebaikan
        </h2>
        <Suspense
          fallback={
            <div className="mt-5">
              <CampaignListSkeleton />
            </div>
          }
        >
          <ProgramList searchParams={searchParams} />
        </Suspense>
      </section>
      <HowItWorks />
      <TransparencySection />
      <TrustSection />
      <FaqSection entries={faq} />
      <ClosingCta />
    </>
  );
}
