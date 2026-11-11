import type { Metadata } from "next";
import { ExternalLink, Mail, MessageCircle, Search, Send } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pager, Pill } from "@/components/admin/finance/pager";
import { fieldClass } from "@/components/admin/form-bits";
import { ResendButton } from "@/components/admin/notifications/resend-button";
import { formatWibDateTime } from "@/components/donor/format";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { RESENDABLE_EVENTS } from "@/lib/notifications/jobs";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_STATUSES,
  notificationLogQuery,
} from "@/lib/validation/admin-notifications";
import {
  findNotificationLog,
  listNotificationLogs,
  listTemplateOptions,
} from "@/server/repositories/admin-notification-repository";
import { canSeeRecipient, maskLogRow, redactProviderResponse } from "@/server/services/admin-notification-service";

export const metadata: Metadata = { title: "Log Notifikasi — Admin Tebar Kebaikan" };

const statusTone = (s: string) => (s === "sent" ? "success" : s === "failed" ? "danger" : s === "queued" ? "info" : "neutral");
const STATUS_LABEL: Record<string, string> = { queued: "antre", sent: "terkirim", failed: "gagal", skipped: "dilewati" };

function ChannelLabel({ channel }: { channel: string }) {
  return channel === "email" ? (
    <span className="inline-flex items-center gap-1">
      <Mail className="size-3.5" aria-hidden />
      Email
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <MessageCircle className="size-3.5" aria-hidden />
      WhatsApp
    </span>
  );
}

// Log notifikasi (F-21): filter kanal/status/template, cari kode transaksi/penerima, penerima
// dimasking di server (OD-21), respons provider ter-redaksi, kirim ulang (baris log baru).
async function Logs({ searchParams }: { searchParams: PageProps<"/admin/log-notifikasi">["searchParams"] }) {
  const ctx = await requireAdmin("notifications.write");
  const mask = !canSeeRecipient(ctx.permissions);
  const canForce = hasPermission(ctx.permissions, "transactions.reconcile");
  const q = notificationLogQuery.parse(await searchParams);
  const [{ rows, total }, rawDetail, templates] = await Promise.all([
    listNotificationLogs(q, mask),
    q.id ? findNotificationLog(q.id) : null,
    listTemplateOptions(),
  ]);
  const detail = rawDetail ? maskLogRow(rawDetail, mask) : null;
  const filters = { q: q.q, kanal: q.kanal, status: q.status, template: q.template };
  const filtered = Object.values(filters).some(Boolean);
  const link = (id: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, hal: q.hal > 1 ? String(q.hal) : undefined, id })) if (v) sp.set(k, v);
    return `/admin/log-notifikasi?${sp.toString()}`;
  };
  const resendable =
    detail && !detail.isTest && detail.transactionId && (RESENDABLE_EVENTS as readonly string[]).includes(detail.event);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Log Notifikasi</h1>
        <p className="mt-1 text-sm text-ink-faint">Riwayat email & WhatsApp. Kegagalan notifikasi tidak memengaruhi status pembayaran.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface">
          <form method="get" className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Filter log notifikasi">
            <div className="relative min-w-0 flex-[1_1_220px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                name="q"
                defaultValue={q.q ?? ""}
                placeholder={mask ? "Kode transaksi, email/nomor persis…" : "Kode transaksi, email, atau nomor…"}
                aria-label="Cari log"
                className={cn(fieldClass, "pl-9")}
              />
            </div>
            <select name="kanal" defaultValue={q.kanal ?? ""} aria-label="Filter kanal" className={cn(fieldClass, "w-auto flex-[1_1_130px]")}>
              <option value="">Semua kanal</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <select name="status" defaultValue={q.status ?? ""} aria-label="Filter status" className={cn(fieldClass, "w-auto flex-[1_1_130px]")}>
              <option value="">Semua status</option>
              {NOTIFICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select name="template" defaultValue={q.template ?? ""} aria-label="Filter template" className={cn(fieldClass, "w-auto min-w-0 flex-[1_1_180px]")}>
              <option value="">Semua template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit" size="lg" variant="secondary">
                Terapkan
              </Button>
              {filtered ? (
                <Link href="/admin/log-notifikasi" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
          {rows.length === 0 ? (
            <EmptyState icon={Send} title="Belum ada notifikasi" description={filtered ? "Coba ubah filter." : "Log muncul setelah ada notifikasi dikirim."} />
          ) : (
            <>
              <ul className="divide-y divide-border" data-testid="notification-rows">
                {rows.map((raw) => {
                  const n = maskLogRow(raw, mask);
                  return (
                    <li key={n.id}>
                      <Link
                        href={link(n.id)}
                        scroll={false}
                        className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-muted/40", q.id === n.id && "bg-primary-soft/40")}
                      >
                        <span className="min-w-0 flex-[1_1_240px]">
                          <span className="flex flex-wrap items-center gap-x-2 text-xs font-semibold">
                            <ChannelLabel channel={n.channel} />
                            <span className="font-mono break-all" data-testid="recipient">
                              {n.recipient}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-ink-faint">
                            {formatWibDateTime(n.createdAt)} · {n.templateName ?? n.event} · {n.transactionCode ?? "tanpa transaksi"}
                          </span>
                        </span>
                        {n.isTest ? <Pill tone="info">tes</Pill> : null}
                        {n.isResend ? <Pill tone="info">kirim ulang</Pill> : null}
                        <Pill tone={statusTone(n.status)}>{STATUS_LABEL[n.status] ?? n.status}</Pill>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Pager basePath="/admin/log-notifikasi" params={filters} page={q.hal} total={total} pageSize={NOTIFICATION_PAGE_SIZE} noun="log" />
            </>
          )}
        </section>
        <aside className="min-w-0 rounded-2xl border border-border bg-surface p-5" aria-label="Detail notifikasi" data-testid="notification-detail">
          {!detail ? (
            <p className="text-sm text-ink-faint">{q.id ? "Log tidak ditemukan." : "Pilih log untuk melihat detail & respons provider."}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Detail notifikasi</h2>
                <Pill tone={statusTone(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Pill>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Kanal", <ChannelLabel key="c" channel={detail.channel} />],
                  ["Penerima", <span key="r" className="font-mono break-all">{detail.recipient}</span>],
                  ["Event", <span key="e" className="font-mono">{detail.event}</span>],
                  ["Template", detail.templateName ? `${detail.templateName}${detail.templateVersion ? ` (v${detail.templateVersion})` : ""}` : "—"],
                  ["Transaksi", detail.transactionCode ?? "—"],
                  ["Percobaan", String(detail.attempt)],
                  ["Dibuat", formatWibDateTime(detail.createdAt)],
                  ["Terkirim", detail.sentAt ? formatWibDateTime(detail.sentAt) : "—"],
                ].map(([k, v]) => (
                  <div key={String(k)} className="min-w-0">
                    <dt className="text-xs text-ink-faint">{k}</dt>
                    <dd className="font-medium break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              {detail.isTest ? <p className="mt-3 text-xs text-ink-faint">Log kirim tes (data contoh, bukan transaksi donatur).</p> : null}
              {detail.errorMessage ? (
                <p className="mt-3 rounded-lg bg-danger-soft p-3 text-xs break-words text-danger">{detail.errorMessage.slice(0, 500)}</p>
              ) : null}
              <p className="mt-4 text-xs font-medium text-ink-faint">Respons provider (ter-redaksi)</p>
              <pre className="mt-1 max-h-[320px] overflow-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-surface" data-testid="provider-response">
                {detail.providerResponse ? JSON.stringify(redactProviderResponse(detail.providerResponse), null, 2) : "—"}
              </pre>
              {resendable ? <ResendButton key={detail.id} logId={detail.id} canForce={canForce} /> : null}
              {detail.transactionId && hasPermission(ctx.permissions, "transactions.read") ? (
                <Link href={`/admin/transaksi/${detail.transactionId}`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}>
                  <ExternalLink aria-hidden />
                  Buka transaksi terkait
                </Link>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </>
  );
}

export default function AdminNotificationLogsPage({ searchParams }: PageProps<"/admin/log-notifikasi">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Logs searchParams={searchParams} />
    </Suspense>
  );
}
