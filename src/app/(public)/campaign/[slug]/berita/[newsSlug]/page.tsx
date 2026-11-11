import { CalendarDays, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DonateButton } from "@/components/public/campaign-detail-view";
import { FundProgress } from "@/components/public/fund-progress";
import { JsonLd } from "@/components/public/json-ld";
import { ShareButton } from "@/components/public/share-button";
import { formatDateJakarta } from "@/lib/format/relative-time";
import { newsJsonLd } from "@/lib/json-ld";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { normalizeSlug } from "@/lib/slug";
import { getPublicNewsDetail, getRecentNewsParams } from "@/server/queries/public-campaign-detail";

// Rute blocking pada `params` agar berita draft/tak dikenal → 404 sungguhan (lihat catatan di
// ../../page.tsx); slug dari generateStaticParams tetap diprerender penuh.
export const instant = false;

type Props = PageProps<"/campaign/[slug]/berita/[newsSlug]">;

async function load(params: Props["params"]) {
  const { slug: rawSlug, newsSlug: rawNews } = await params;
  const slug = normalizeSlug(rawSlug);
  const newsSlug = normalizeSlug(rawNews);
  if (!slug || slug !== rawSlug || !newsSlug || newsSlug !== rawNews) return null;
  return getPublicNewsDetail(slug, newsSlug);
}

export async function generateStaticParams() {
  return getRecentNewsParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = await load(params);
  if (!n) return { title: `Kabar tidak ditemukan — ${SITE_NAME}`, robots: { index: false } };
  const title = `${n.seoTitle ?? n.title} — ${SITE_NAME}`;
  const description = n.seoDescription ?? n.excerpt ?? n.campaign.title;
  const url = `/campaign/${n.campaign.slug}/berita/${n.slug}`;
  const image = n.imageUrl
    ? { url: n.imageUrl, alt: n.imageAlt ?? n.title }
    : { url: n.campaign.imageUrl, alt: n.campaign.imageAlt };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      publishedTime: n.publishedAt.toISOString(),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const n = await load(params);
  if (!n) notFound();
  const campaignPath = `/campaign/${n.campaign.slug}`;
  const jsonLd = newsJsonLd({
    site: siteUrl(),
    siteName: SITE_NAME,
    campaignSlug: n.campaign.slug,
    campaignTitle: n.campaign.title,
    newsSlug: n.slug,
    title: n.title,
    description: n.seoDescription ?? n.excerpt,
    imageUrl: n.imageUrl ?? n.campaign.imageUrl,
    publishedAt: n.publishedAt,
    updatedAt: n.updatedAt,
  });
  return (
    <article className="mx-auto max-w-3xl px-4 py-6">
      <JsonLd data={jsonLd} />
      <Link href={campaignPath} className="flex items-center gap-1 text-sm font-medium text-primary">
        <ChevronLeft className="size-4" aria-hidden />
        Kembali ke program
      </Link>
      <p className="mt-6 text-xs font-semibold tracking-wide text-gold uppercase">Kabar Program</p>
      <h1 className="mt-2 font-display text-2xl leading-tight font-bold break-words md:text-3xl">
        {n.title}
      </h1>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm text-ink-faint">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden />
          <time dateTime={n.publishedAt.toISOString()}>{formatDateJakarta(n.publishedAt)}</time>
          <span aria-hidden>·</span> Tim Program
        </span>
        <ShareButton title={n.title} variant="ghost" />
      </div>
      {n.imageUrl ? (
        <div className="relative mt-5 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-primary-soft">
          <Image
            src={n.imageUrl}
            alt={n.imageAlt ?? ""}
            fill
            priority
            sizes="(min-width: 768px) 720px, 100vw"
            unoptimized={n.imageUrl.endsWith(".svg")}
            className="object-cover"
          />
        </div>
      ) : null}
      <div
        className="prose-tk mt-6 break-words"
        // HTML sudah disanitasi di server (sanitizeRichText, whitelist).
        dangerouslySetInnerHTML={{ __html: n.contentHtml }}
      />

      <section
        className="mt-8 rounded-2xl border border-border bg-surface p-4 shadow-card"
        aria-labelledby="program-terkait"
      >
        <p id="program-terkait" className="text-xs font-semibold text-ink-faint">
          Program terkait
        </p>
        <Link href={campaignPath} className="mt-3 flex gap-3">
          <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
            <Image
              src={n.campaign.imageUrl}
              alt={n.campaign.imageAlt}
              fill
              sizes="96px"
              unoptimized={n.campaign.imageUrl.endsWith(".svg")}
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold">{n.campaign.title}</p>
            <div className="mt-2">
              <FundProgress collected={n.campaign.collectedAmount} target={n.campaign.targetAmount} />
            </div>
          </div>
        </Link>
        <div className="mt-4" data-testid="cta-news">
          <DonateButton slug={n.campaign.slug} status={n.campaign.status} label="Lanjutkan Kebaikan Ini" />
        </div>
      </section>

      {n.otherNews.length > 0 ? (
        <section className="mt-8" aria-labelledby="kabar-lain">
          <h2 id="kabar-lain" className="font-bold">
            Kabar lain dari program ini
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {n.otherNews.map((x) => (
              <li key={x.slug}>
                <Link href={`${campaignPath}/berita/${x.slug}`} className="block px-4 py-3 hover:bg-muted">
                  <p className="text-xs text-ink-faint">{formatDateJakarta(x.publishedAt)}</p>
                  <p className="text-sm font-semibold break-words">{x.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
