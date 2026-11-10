import { ChevronRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { formatRupiah } from "@/lib/money";
import type { DonorTrxListItem } from "@/server/repositories/donor-dashboard-repository";
import { formatWibDate } from "./format";
import { TrxStatusBadge } from "./trx-status-badge";

export function TrxList({ items }: { items: DonorTrxListItem[] }) {
  return (
    <ul className="divide-y divide-border" data-testid="trx-list">
      {items.map((t) => (
        <li key={t.id}>
          <Link
            href={`/akun/donasi/${t.code}`}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted"
            data-testid="trx-item"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ReceiptText className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{t.campaignTitle}</span>
              <span className="block truncate text-xs text-ink-faint">
                {formatWibDate(t.createdAt)}
                {t.methodName ? ` · ${t.methodName}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-bold tabular-nums">{formatRupiah(t.amount)}</span>
              <TrxStatusBadge status={t.status} />
            </span>
            <ChevronRight className="hidden size-4 text-ink-faint sm:block" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
