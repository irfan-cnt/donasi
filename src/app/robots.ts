import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW, isIndexable } from "@/lib/seo";
import { siteUrl } from "@/lib/site";

// Non-production (preview/development) menutup seluruh situs; production hanya area privat.
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...ROBOTS_DISALLOW] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
