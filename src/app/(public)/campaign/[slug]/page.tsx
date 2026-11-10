import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignDetailView, donateHref } from "@/components/public/campaign-detail-view";
import { JsonLd } from "@/components/public/json-ld";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { normalizeSlug } from "@/lib/slug";
import { getPublicCampaignDetail } from "@/server/queries/public-campaign-detail";
import { getSitemapCampaigns } from "@/server/queries/public-campaigns";

// Slug huruf besar sudah di-redirect 301 oleh src/proxy.ts; di sini slug tidak kanonik → 404.
async function load(rawSlug: string) {
  const slug = normalizeSlug(rawSlug);
  if (!slug || slug !== rawSlug) return null;
  return getPublicCampaignDetail(slug);
}

export async function generateStaticParams() {
  const rows = await getSitemapCampaigns();
  return rows.slice(0, 50).map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/campaign/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) return { title: `Program tidak ditemukan — ${SITE_NAME}`, robots: { index: false } };
  const title = `${c.seoTitle ?? c.title} — ${SITE_NAME}`;
  const description = c.seoDescription ?? c.shortDescription;
  const url = `/campaign/${c.slug}`;
  const image = c.images[0];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      images: image ? [{ url: image.url, alt: image.alt }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image.url] : undefined },
  };
}

export default async function CampaignDetailPage({ params }: PageProps<"/campaign/[slug]">) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();
  const site = siteUrl();
  const url = `${site}/campaign/${c.slug}`;
  const image = c.images[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: c.title,
    description: c.seoDescription ?? c.shortDescription,
    image: image ? new URL(image.url, site).toString() : undefined,
    dateModified: c.updatedAt.toISOString(),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: site },
    potentialAction: {
      "@type": "DonateAction",
      name: "Donasi Sekarang",
      target: `${site}${donateHref(c.slug)}`,
      recipient: { "@type": "Organization", name: SITE_NAME, url: site },
      actionStatus:
        c.status === "published" ? "https://schema.org/PotentialActionStatus" : "https://schema.org/CompletedActionStatus",
    },
  };
  return (
    <>
      <JsonLd data={jsonLd} />
      <CampaignDetailView c={c} />
    </>
  );
}
