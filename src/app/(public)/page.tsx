import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CampaignList } from "@/components/public/campaign-list";
import { CategoryChips } from "@/components/public/category-chips";
import { EmptyState } from "@/components/public/empty-state";
import { JsonLd } from "@/components/public/json-ld";
import {
  ClosingCta,
  FaqSection,
  HeroView,
  HowItWorks,
  ProgramSection,
  ProgramSkeleton,
  TransparencySection,
  TrustSection,
  TrustStripView,
  UrgentSection,
} from "@/components/public/landing-sections";
import { LandingFloating } from "@/components/public/landing-floating";
import { lpButton } from "@/components/public/landing-ui";
import { TrackClicks } from "@/components/shared/track-clicks";
import { faqJsonLd, organizationJsonLd } from "@/lib/json-ld";
import { showPlatformStats } from "@/lib/landing";
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
  const [featured, stats] = await Promise.all([getFeaturedCampaign(), getPlatformStats()]);
  return (
    <HeroView
      featured={featured}
      donations={showPlatformStats(stats.paidDonations) ? stats.paidDonations : undefined}
    />
  );
}

async function TrustStrip() {
  return <TrustStripView stats={await getPlatformStats()} />;
}

async function UrgentRow() {
  return <UrgentSection items={await getUrgentCampaigns(3)} />;
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
      <CategoryChips categories={categories} active={kategori} basePath="/" variant="landing" />
      <div className="mt-5">
        {page.items.length === 0 ? (
          <EmptyState
            className="rounded-[22px] border border-dashed border-[#C6D1C8] bg-[#FBFCFA] py-14"
            icon={HeartHandshake}
            title={kategori ? "Belum ada program di kategori ini" : "Program kebaikan segera hadir"}
            description={
              kategori
                ? "Program kebaikan baru segera hadir. Coba lihat kategori lain."
                : "Program kebaikan baru segera hadir. Kunjungi kembali halaman ini nanti."
            }
            action={
              kategori ? (
                <Link href="/" scroll={false} className={lpButton("green")}>
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
            variant="landing"
          />
        )}
      </div>
    </>
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  const faq = visibleFaq();
  return (
    // .lp = palet desain beranda (globals.css); -mb-12 meniadakan jarak atas footer bersama.
    <div className="lp -mb-12 overflow-x-clip bg-bg">
      <JsonLd data={organizationJsonLd(siteUrl(), SITE_NAME)} />
      <JsonLd data={faqJsonLd(faq)} />
      <TrackClicks />
      <Hero />
      <TrustStrip />
      <UrgentRow />
      <ProgramSection>
        <Suspense fallback={<ProgramSkeleton />}>
          <ProgramList searchParams={searchParams} />
        </Suspense>
      </ProgramSection>
      <HowItWorks />
      <TransparencySection />
      <TrustSection />
      <FaqSection entries={faq} />
      <ClosingCta />
      <LandingFloating />
    </div>
  );
}
