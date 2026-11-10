import { cn } from "@/lib/utils";
import { formatRupiah, progressPercent } from "@/lib/money";

export function FundProgress({
  collected,
  target,
  size = "sm",
}: {
  collected: bigint;
  target: bigint | null;
  size?: "sm" | "lg";
}) {
  const pct = target ? progressPercent(collected, target) : 0;
  const bar = size === "lg" ? "h-2.5" : "h-1.5";
  return (
    <div>
      {target ? (
        <div
          role="progressbar"
          aria-label="Progres penggalangan"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className={cn("overflow-hidden rounded-full bg-muted", bar)}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className={cn("rounded-full bg-gold-soft", bar)} />
      )}
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "tabular font-bold text-primary-ink",
              size === "lg" ? "text-2xl" : "text-sm",
            )}
          >
            {formatRupiah(collected)}
          </p>
          <p className="text-xs text-ink-faint">
            {target ? <>terkumpul dari {formatRupiah(target)}</> : "terkumpul · tanpa target"}
          </p>
        </div>
        {target ? <span className="text-xs font-semibold text-ink-soft">{pct}%</span> : null}
      </div>
    </div>
  );
}
