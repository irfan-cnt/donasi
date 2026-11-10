import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { getSitemapCampaigns } from "@/server/queries/public-campaigns";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const campaigns = await getSitemapCampaigns();
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/campaign`, changeFrequency: "hourly", priority: 0.8 },
    ...campaigns.map((c) => ({
      url: `${base}/campaign/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
