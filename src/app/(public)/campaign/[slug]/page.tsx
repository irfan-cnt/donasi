import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampaignDetailView, donateHref } from "@/components/public/campaign-detail-view";
import { JsonLd } from "@/components/public/json-ld";
import { campaignJsonLd } from "@/lib/json-ld";
import { DEFAULT_OG_IMAGE, SITE_NAME, siteUrl } from "@/lib/site";
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
      images: image ? [{ url: image.url, alt: image.alt }] : [DEFAULT_OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [image ? image.url : DEFAULT_OG_IMAGE.url] },
  };
}

export default async function CampaignDetailPage({ params }: PageProps<"/campaign/[slug]">) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();
  const jsonLd = campaignJsonLd({
    site: siteUrl(),
    siteName: SITE_NAME,
    slug: c.slug,
    title: c.title,
    description: c.seoDescription ?? c.shortDescription,
    imageUrl: c.images[0]?.url ?? null,
    updatedAt: c.updatedAt,
    donateHref: donateHref(c.slug),
    active: c.status === "published",
  });
  return (
    <>
      <JsonLd data={jsonLd} />
      <CampaignDetailView c={c} />
    </>
  );
}
