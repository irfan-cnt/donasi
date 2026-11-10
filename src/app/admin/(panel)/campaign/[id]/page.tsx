import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CampaignEditorPage } from "@/components/admin/campaign-editor-page";

export const metadata: Metadata = { title: "Edit Campaign — Admin Tebar Kebaikan" };

async function Body({ params }: { params: PageProps<"/admin/campaign/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <CampaignEditorPage id={id} />;
}

export default function EditCampaignPage({ params }: PageProps<"/admin/campaign/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Body params={params} />
    </Suspense>
  );
}
