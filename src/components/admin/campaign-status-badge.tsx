import { CAMPAIGN_STATUS_LABEL, type CampaignStatusCode } from "@/lib/campaign-rules";
import { cn } from "@/lib/utils";

const TONE: Record<CampaignStatusCode, string> = {
  published: "bg-success-soft text-success",
  paused: "bg-warning-soft text-warning",
  draft: "bg-muted text-ink-soft",
  completed: "bg-info-soft text-info",
  archived: "bg-muted text-ink-faint",
};

export function CampaignStatusBadge({ status, className }: { status: CampaignStatusCode; className?: string }) {
  return (
    <span
      data-testid="campaign-status"
      className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap", TONE[status], className)}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {CAMPAIGN_STATUS_LABEL[status]}
    </span>
  );
}
