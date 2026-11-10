import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const STEPS = ["Nominal & Data", "Pembayaran", "Selesaikan"] as const;

/** Layout alur donasi (mockup FlowLayout): header ringkas + indikator langkah, tanpa nav publik. */
export function FlowLayout({
  title,
  backHref,
  step,
  children,
  withFooter = false,
}: {
  title: string;
  backHref?: string;
  step?: 1 | 2 | 3;
  children: ReactNode;
  /** Sisakan ruang bawah untuk bar CTA fixed. */
  withFooter?: boolean;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          {backHref && (
            <Link href={backHref} aria-label="Kembali" className="-ml-2 rounded-lg p-2 hover:bg-muted">
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
          )}
          <Logo variant="icon" size="xs" />
          <h1 className="font-semibold">{title}</h1>
          <span className="ml-auto flex items-center gap-1 text-xs text-ink-faint">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Aman
          </span>
        </div>
        {step && (
          <ol className="mx-auto flex max-w-2xl gap-2 px-4 pb-3" aria-label="Langkah donasi">
            {STEPS.map((s, i) => (
              <li key={s} className="flex-1" aria-current={i + 1 === step ? "step" : undefined}>
                <div className={cn("h-1 rounded-full", i < step ? "bg-primary" : "bg-border")} />
                <p className={cn("mt-1.5 text-[11px] font-medium", i < step ? "text-primary" : "text-ink-faint")}>
                  {i + 1}. {s}
                </p>
              </li>
            ))}
          </ol>
        )}
      </header>
      <main className={cn("mx-auto max-w-2xl px-4 py-5", withFooter && "pb-32")}>{children}</main>
    </div>
  );
}
