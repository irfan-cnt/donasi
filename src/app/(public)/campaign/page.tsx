import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CampaignList } from "@/components/public/campaign-list";
import { CampaignListSkeleton } from "@/components/public/campaign-list-skeleton";
import { CategoryChips } from "@/components/public/category-chips";
import { EmptyState } from "@/components/public/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { parseCategoryParam } from "@/lib/validation/campaign-list";
import { getCampaignPage, getPublicCategories } from "@/server/queries/public-campaigns";

export const metadata: Metadata = {
  title: "Semua Program Donasi — Tebar Kebaikan",
  description:
    "Daftar program donasi yang sedang berjalan dan yang telah selesai di Tebar Kebaikan. Saring berdasarkan kategori dan pilih program kebaikanmu.",
  alternates: { canonical: "/campaign" },
  openGraph: {
    type: "website",
    url: "/campaign",
    title: "Semua Program Donasi — Tebar Kebaikan",
    description: "Daftar program donasi yang sedang berjalan dan yang telah selesai.",
  },
};

async function Listing({ searchParams }: { searchParams: PageProps<"/campaign">["searchParams"] }) {
  const [params, categories] = await Promise.all([searchParams, getPublicCategories()]);
  const kategori = parseCategoryParam(
    params.kategori,
    categories.map((c) => c.slug),
  );
  const [active, completed] = await Promise.all([
    getCampaignPage({ status: "published", categorySlug: kategori }),
    getCampaignPage({ status: "completed", categorySlug: kategori }),
  ]);
  const empty = active.items.length === 0 && completed.items.length === 0;
  return (
    <>
      <div className="mt-5">
        <CategoryChips categories={categories} active={kategori} basePath="/campaign" />
      </div>
      {empty ? (
        <EmptyState
          className="mt-5"
          icon={HeartHandshake}
          title="Belum ada program di kategori ini"
          description="Program kebaikan baru segera hadir. Coba lihat kategori lain."
          action={
            kategori ? (
              <Link href="/campaign" scroll={false} className={buttonVariants({ variant: "outline" })}>
                Lihat semua program
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className="mt-6" aria-labelledby="program-aktif">
            <h2 id="program-aktif" className="text-xl font-bold">
              Program berjalan
            </h2>
            <div className="mt-4">
              {active.items.length === 0 ? (
                <EmptyState
                  icon={HeartHandshake}
                  title="Belum ada program berjalan di kategori ini"
                  className="py-8"
                />
              ) : (
                <CampaignList
                  key={`published-${kategori ?? "semua"}`}
                  initialItems={active.items}
                  initialCursor={active.nextCursor}
                  kategori={kategori}
                />
              )}
            </div>
          </section>
          {completed.items.length > 0 ? (
            <section className="mt-10" aria-labelledby="program-selesai">
              <h2 id="program-selesai" className="text-xl font-bold">
                Program selesai
              </h2>
              <div className="mt-4">
                <CampaignList
                  key={`completed-${kategori ?? "semua"}`}
                  initialItems={completed.items}
                  initialCursor={completed.nextCursor}
                  status="completed"
                  kategori={kategori}
                />
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

export default function CampaignListingPage({ searchParams }: PageProps<"/campaign">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Semua Program Kebaikan</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Pilih program yang ingin kamu dukung. Setiap donasi tercatat dan dilaporkan.
      </p>
      <Suspense fallback={<div className="mt-5"><CampaignListSkeleton /></div>}>
        <Listing searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
