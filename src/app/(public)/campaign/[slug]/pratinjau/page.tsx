import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CampaignDetailView } from "@/components/public/campaign-detail-view";
import { readCampaignPreviewToken } from "@/lib/security/preview-token";
import { normalizeSlug } from "@/lib/slug";
import { getCampaignPreview } from "@/server/queries/public-campaign-detail";

// Pratinjau admin untuk campaign draft: /campaign/{slug}/pratinjau?token=… (berlaku 1 jam).
// Dinamis & tidak di-cache (rute blocking agar token tidak sah → 404 sungguhan); tidak diindeks.
export const instant = false;

export const metadata: Metadata = {
  title: "Pratinjau program",
  robots: { index: false, follow: false },
};

const querySchema = z.object({ token: z.string().min(1).max(200) });

export default async function CampaignPreviewPage({
  params,
  searchParams,
}: PageProps<"/campaign/[slug]/pratinjau">) {
  const [{ slug: raw }, query] = await Promise.all([params, searchParams]);
  const slug = normalizeSlug(raw);
  const parsed = querySchema.safeParse(query);
  const campaignId = parsed.success ? readCampaignPreviewToken(parsed.data.token) : null;
  if (!slug || !campaignId) notFound();
  const c = await getCampaignPreview(slug, campaignId);
  if (!c) notFound();
  return <CampaignDetailView c={c} />;
}
