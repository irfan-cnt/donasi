import { CampaignListSkeleton } from "@/components/public/campaign-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="h-64 rounded-2xl" />
      <div className="mt-10">
        <CampaignListSkeleton />
      </div>
    </div>
  );
}
