import { Construction } from "lucide-react";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-auth";
import { navItem } from "@/lib/admin-auth/admin-nav";

// Halaman menu yang belum dibangun (P21–P23): dijaga permission yang sama dengan menu, sehingga
// tidak ada tautan 404 dan tidak ada data yang dirender. Diganti halaman nyata di prompt terkait.
async function Body({ href, prompt }: { href: string; prompt: string }) {
  const item = navItem(href);
  await requireAdmin(item.permission);
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">{item.label}</h1>
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
        <Construction className="size-8 text-ink-faint" aria-hidden />
        <p className="mt-3 font-semibold text-ink">Segera hadir</p>
        <p className="mt-1 text-sm text-ink-faint">Halaman ini sedang disiapkan ({prompt}).</p>
      </div>
    </>
  );
}

export function ComingSoon({ href, prompt }: { href: string; prompt: string }) {
  return (
    <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
      <Body href={href} prompt={prompt} />
    </Suspense>
  );
}
