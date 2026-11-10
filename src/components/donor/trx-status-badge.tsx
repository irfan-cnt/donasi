import { cn } from "@/lib/utils";

type Status = "created" | "pending" | "paid" | "expired" | "failed" | "cancelled" | "refunded";

const LABEL: Record<Status, [string, string]> = {
  created: ["Menunggu", "bg-warning-soft text-warning"],
  pending: ["Menunggu", "bg-warning-soft text-warning"],
  paid: ["Berhasil", "bg-primary-soft text-primary-ink"],
  expired: ["Kedaluwarsa", "bg-muted text-ink-faint"],
  failed: ["Gagal", "bg-danger-soft text-danger"],
  cancelled: ["Dibatalkan", "bg-muted text-ink-faint"],
  refunded: ["Dikembalikan", "bg-muted text-ink-soft"],
};

export function TrxStatusBadge({ status, className }: { status: Status; className?: string }) {
  const [label, tone] = LABEL[status];
  return (
    <span
      className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold whitespace-nowrap", tone, className)}
      data-testid="trx-status"
    >
      {label}
    </span>
  );
}
