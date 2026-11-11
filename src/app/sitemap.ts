import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { getSitemapCampaigns, getSitemapNews } from "@/server/queries/public-campaigns";

// Hanya URL publik kanonik: campaign published/completed + berita published-nya. Tanpa draft,
// paused, archived, pratinjau (token) maupun halaman privat (P24).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [campaigns, news] = await Promise.all([getSitemapCampaigns(), getSitemapNews()]);
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/campaign`, changeFrequency: "hourly", priority: 0.8 },
    ...campaigns.map((c) => ({
      url: `${base}/campaign/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...news.map((n) => ({
      url: `${base}/campaign/${n.slug}/berita/${n.newsSlug}`,
      lastModified: n.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
