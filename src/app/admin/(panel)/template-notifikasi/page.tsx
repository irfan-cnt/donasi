import type { Metadata } from "next";
import { FileText, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pill } from "@/components/admin/finance/pager";
import { TemplateEditor } from "@/components/admin/notifications/template-editor";
import { formatWibDateTime } from "@/components/donor/format";
import { EmptyState } from "@/components/public/empty-state";
import { requireAdmin } from "@/lib/admin-auth";
import { siteUrl, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";
import { templatePageQuery } from "@/lib/validation/admin-notifications";
import { findAdminContact, listTemplates } from "@/server/repositories/admin-notification-repository";
import { findOrganizationSettings } from "@/server/repositories/notification-repository";

export const metadata: Metadata = { title: "Template Notifikasi — Admin Tebar Kebaikan" };

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

// Template notifikasi (F-20): daftar per kanal, editor, pratinjau, kirim tes. Satu aktif per event+kanal (BR-30).
async function Templates({ searchParams }: { searchParams: PageProps<"/admin/template-notifikasi">["searchParams"] }) {
  const ctx = await requireAdmin("notifications.write");
  const q = templatePageQuery.parse(await searchParams);
  const [list, org, admin] = await Promise.all([listTemplates(q.kanal), findOrganizationSettings(), findAdminContact(ctx.adminId)]);
  const selected = list.find((t) => t.id === q.id) ?? list[0] ?? null;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Template Notifikasi</h1>
        <p className="mt-1 text-sm text-ink-faint">Satu template aktif per event & kanal. Setiap simpan membuat versi baru.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="min-w-0 self-start rounded-2xl border border-border bg-surface p-3" aria-label="Daftar template">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Kanal">
            {CHANNELS.map((c) => (
              <Link
                key={c.value}
                href={`/admin/template-notifikasi?kanal=${c.value}`}
                aria-current={q.kanal === c.value ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium",
                  q.kanal === c.value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                <c.icon className="size-4" aria-hidden />
                {c.label}
              </Link>
            ))}
          </div>
          <ul className="mt-3 space-y-1" data-testid="template-list">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/template-notifikasi?kanal=${q.kanal}&id=${t.id}`}
                  aria-current={selected?.id === t.id ? "page" : undefined}
                  className={cn("block rounded-xl px-3 py-2.5", selected?.id === t.id ? "bg-primary-soft" : "hover:bg-muted")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-sm font-medium break-words">{t.name}</span>
                    {t.isActive ? <Pill tone="success">Aktif</Pill> : <Pill>Nonaktif</Pill>}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-faint">
                    {t.event} · v{t.version}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {selected ? (
          <TemplateEditor
            key={`${selected.id}:${selected.version}:${selected.isActive}`}
            template={{
              id: selected.id,
              event: selected.event,
              channel: selected.channel,
              name: selected.name,
              subject: selected.subject,
              body: selected.body,
              isActive: selected.isActive,
              version: selected.version,
              updatedLabel: `diubah ${formatWibDateTime(selected.updatedAt)}${selected.updatedByName ? ` oleh ${selected.updatedByName}` : ""}`,
            }}
            org={{ name: org.name ?? SITE_NAME, address: org.address ?? "", siteUrl: siteUrl() }}
            adminEmail={admin?.email ?? ctx.email}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-surface">
            <EmptyState icon={FileText} title="Belum ada template" description="Template dibuat oleh seed data (pnpm db:seed)." />
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminTemplatesPage({ searchParams }: PageProps<"/admin/template-notifikasi">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Templates searchParams={searchParams} />
    </Suspense>
  );
}
