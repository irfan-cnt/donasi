import type { Metadata } from "next";
import { History } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pager } from "@/components/admin/finance/pager";
import { fieldClass } from "@/components/admin/form-bits";
import { formatWibDateTime } from "@/components/donor/format";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { maskPiiDeep, maskPiiText } from "@/lib/format/mask";
import { cn } from "@/lib/utils";
import { auditQuery, FINANCE_PAGE_SIZE } from "@/lib/validation/admin-finance";
import { auditFilterOptions, listAuditLogs } from "@/server/repositories/admin-finance-repository";

export const metadata: Metadata = { title: "Audit Log — Admin Tebar Kebaikan" };

const ACTOR_LABEL: Record<string, string> = { system: "Sistem", provider: "Provider", donor: "Donatur" };

/** Ringkas diff before→after per field (read-only, tanpa HTML). */
function changes(before: unknown, after: unknown, metadata: unknown): string {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const fmt = (v: unknown) => (v === undefined ? "—" : JSON.stringify(v)).slice(0, 80);
  if (keys.length) return keys.map((k) => `${k}: ${fmt(b[k])} → ${fmt(a[k])}`).join("; ");
  return metadata ? JSON.stringify(metadata).slice(0, 240) : "—";
}

// Audit log (F-30): read-only; filter aktor/aksi/entitas (+ id entitas persis). Tidak ada aksi ubah/hapus.
async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const ctx = await requireAdmin("audit.read");
  const q = auditQuery.parse(await searchParams);
  const [{ rows: raw, total }, opts] = await Promise.all([listAuditLogs(q), auditFilterOptions()]);
  // M2: entri lama bisa memuat email/WA (mis. kata kunci ekspor). Disamarkan DI SERVER untuk
  // admin tanpa donors.export sebelum dirender — nilai penuh tidak pernah dikirim ke browser.
  const piiVisible = hasPermission(ctx.permissions, "donors.export");
  const rows = piiVisible
    ? raw
    : raw.map((r) => ({
        ...r,
        entityId: r.entityId === null ? null : maskPiiText(r.entityId),
        before: maskPiiDeep(r.before),
        after: maskPiiDeep(r.after),
        metadata: maskPiiDeep(r.metadata),
      }));
  const filters = { aktor: q.aktor, aksi: q.aksi, entitas: q.entitas, q: q.q };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Audit Log</h1>
        <p className="mt-1 text-sm text-ink-faint">Catatan perubahan oleh admin & sistem (read-only)</p>
      </div>
      <section className="min-w-0 rounded-2xl border border-border bg-surface">
        <form method="get" className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Filter audit log">
          <input name="q" defaultValue={q.q ?? ""} placeholder="Id entitas (persis)…" aria-label="Id entitas" className={cn(fieldClass, "min-w-0 flex-[1_1_200px]")} />
          <select name="aktor" defaultValue={q.aktor ?? ""} aria-label="Filter aktor" className={cn(fieldClass, "w-auto min-w-0 flex-[1_1_150px]")}>
            <option value="">Semua aktor</option>
            <option value="system">Sistem</option>
            <option value="provider">Provider</option>
            <option value="donor">Donatur</option>
            {opts.admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="aksi" defaultValue={q.aksi ?? ""} aria-label="Filter aksi" className={cn(fieldClass, "w-auto min-w-0 flex-[1_1_170px]")}>
            <option value="">Semua aksi</option>
            {opts.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select name="entitas" defaultValue={q.entitas ?? ""} aria-label="Filter entitas" className={cn(fieldClass, "w-auto min-w-0 flex-[1_1_150px]")}>
            <option value="">Semua entitas</option>
            {opts.entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="lg" variant="secondary">
              Terapkan
            </Button>
            {filtered ? (
              <Link href="/admin/audit" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                Reset
              </Link>
            ) : null}
          </div>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="Belum ada aktivitas" description={filtered ? "Coba ubah filter." : undefined} />
        ) : (
          <>
            <ul className="divide-y divide-border" data-testid="audit-rows">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-mono text-xs font-semibold break-all">{r.action}</span>
                    <span className="text-xs whitespace-nowrap text-ink-faint">{formatWibDateTime(r.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs break-all text-ink-faint">
                    {r.actorType === "admin" ? (r.actorName ?? "Admin") : (ACTOR_LABEL[r.actorType] ?? r.actorType)} · {r.entityType}
                    {r.entityId ? ` ${r.entityId}` : ""}
                    {r.ip ? ` · ${r.ip}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-xs break-all text-ink-soft">{changes(r.before, r.after, r.metadata)}</p>
                </li>
              ))}
            </ul>
            <Pager basePath="/admin/audit" params={filters} page={q.hal} total={total} pageSize={FINANCE_PAGE_SIZE} noun="entri" />
          </>
        )}
      </section>
    </>
  );
}

export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}
