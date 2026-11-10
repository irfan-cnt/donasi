import { CircleSlash2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = CircleSlash2,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center px-6 py-12 text-center", className)}
      data-testid="empty-state"
    >
      <div className="pattern-islamic-dark mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft">
        <Icon className="size-6 text-primary" aria-hidden />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-faint">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
