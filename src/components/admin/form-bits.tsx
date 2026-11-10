import { cn } from "@/lib/utils";

// Potongan form admin kecil (label, error, kartu, select native) — selaras mockup primitives.
export const fieldClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-danger";

export function FieldLabel({ htmlFor, children, optional, id }: { htmlFor?: string; children: React.ReactNode; optional?: boolean; id?: string }) {
  return (
    <label htmlFor={htmlFor} id={id} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {optional ? <span className="ml-1 text-xs font-normal text-ink-faint">(opsional)</span> : null}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1 text-xs text-danger" role="alert">
      {children}
    </p>
  );
}

export function Panel({ title, description, action, children, className }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-faint">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
