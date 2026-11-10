import type { Metadata } from "next";
import { Suspense } from "react";
import { CampaignEditorPage } from "@/components/admin/campaign-editor-page";

export const metadata: Metadata = { title: "Campaign Baru — Admin Tebar Kebaikan" };

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <CampaignEditorPage id={null} />
    </Suspense>
  );
}
