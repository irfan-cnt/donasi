/**
 * Serialisasi JSON-LD yang aman untuk disisipkan di <script type="application/ld+json">:
 * `<`, `>`, `&`, U+2028/U+2029 di-escape sehingga teks dari DB tidak bisa menutup tag
 * (`</script>`) atau menyuntik HTML.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Builder JSON-LD schema.org (P24): murni & teruji (tests/unit/seo.test.ts). `site` = siteUrl().

export function organizationJsonLd(site: string, name: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name,
        url: site,
        logo: `${site}/brand/icon-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        name,
        url: site,
        inLanguage: "id-ID",
        publisher: { "@id": `${site}/#organization` },
      },
    ],
  };
}

export function campaignJsonLd(input: {
  site: string;
  siteName: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  updatedAt: Date;
  donateHref: string;
  active: boolean;
}) {
  const { site, siteName } = input;
  const url = `${site}/campaign/${input.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: input.title,
    description: input.description,
    image: input.imageUrl ? new URL(input.imageUrl, site).toString() : undefined,
    dateModified: input.updatedAt.toISOString(),
    inLanguage: "id-ID",
    isPartOf: { "@type": "WebSite", name: siteName, url: site },
    potentialAction: {
      "@type": "DonateAction",
      name: "Donasi Sekarang",
      target: `${site}${input.donateHref}`,
      recipient: { "@type": "Organization", name: siteName, url: site },
      actionStatus: input.active
        ? "https://schema.org/PotentialActionStatus"
        : "https://schema.org/CompletedActionStatus",
    },
  };
}

export function newsJsonLd(input: {
  site: string;
  siteName: string;
  campaignSlug: string;
  campaignTitle: string;
  newsSlug: string;
  title: string;
  description: string | null;
  imageUrl: string;
  publishedAt: Date;
  updatedAt: Date;
}) {
  const { site, siteName } = input;
  const campaignUrl = `${site}/campaign/${input.campaignSlug}`;
  const url = `${campaignUrl}/berita/${input.newsSlug}`;
  const org = { "@type": "Organization", name: siteName, url: site };
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: input.title.slice(0, 110),
    description: input.description ?? undefined,
    image: [new URL(input.imageUrl, site).toString()],
    datePublished: input.publishedAt.toISOString(),
    dateModified: input.updatedAt.toISOString(),
    inLanguage: "id-ID",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: org,
    publisher: { ...org, logo: { "@type": "ImageObject", url: `${site}/brand/icon-512.png` } },
    about: { "@type": "WebPage", name: input.campaignTitle, url: campaignUrl },
  };
}

/** FAQPage (P30): dibangun dari butir FAQ yang SAMA dengan yang dirender (visibleFaq). */
export function faqJsonLd(entries: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.answer },
    })),
  };
}
