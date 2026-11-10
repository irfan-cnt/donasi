import { Logo } from "@/components/shared/logo";

/** Kartu tengah berlatar hijau tua (mockup admin-login). */
export function AdminAuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center bg-primary-ink px-4 py-10">
      <div className="fixed inset-0 pattern-islamic" aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-lg">
        <Logo />
        <span className="mt-3 flex w-fit rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold text-gold">
          Panel Admin
        </span>
        <h1 className="mt-4 text-xl font-bold text-ink">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
      {children}
    </label>
  );
}
