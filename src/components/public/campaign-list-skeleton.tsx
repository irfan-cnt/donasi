import { Skeleton } from "@/components/ui/skeleton";

export function CampaignListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Memuat program">
      <div className="space-y-3 md:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-24 w-28 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden gap-5 md:grid md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
