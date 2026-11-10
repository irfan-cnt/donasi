import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pill } from "@/components/admin/finance/pager";
import { StatusCheckButton } from "@/components/admin/finance/status-check-button";
import { Panel } from "@/components/admin/form-bits";
import { formatWibDateTime } from "@/components/donor/format";
import { TrxStatusBadge } from "@/components/donor/trx-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-auth/permissions";
import { maskEmail, maskPhone } from "@/lib/format/mask";
import { formatRupiah } from "@/lib/money";
import { findTransactionDetail } from "@/server/repositories/admin-finance-repository";
import { canSeeDonorPii, maskTransactionRow } from "@/server/services/admin-finance-service";

export const metadata: Metadata = { title: "Detail Transaksi — Admin Tebar Kebaikan" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;
const t = (d: Date | null) => (d ? formatWibDateTime(d) : "—");

function sourceLabel(src: unknown): string {
  if (!src || typeof src !== "object") return "—";
  const s = src as Record<string, unknown>;
  const parts = [s.utm_source, s.utm_medium, s.utm_campaign, s.ref].filter((x): x is string => typeof x === "string" && !!x);
  return parts.length ? parts.join(" / ").slice(0, 120) : "—";
}

// Detail transaksi (F-27): percobaan bayar, payment events, notifikasi, donatur. Satu-satunya
// aksi = cek status ke provider (transactions.reconcile). Tidak ada "tandai lunas" (AC-27.1).
async function Detail({ params }: { params: PageProps<"/admin/transaksi/[id]">["params"] }) {
  const ctx = await requireAdmin("transactions.read");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const raw = await findTransactionDetail(id);
  if (!raw) notFound();
  const piiVisible = canSeeDonorPii(ctx.permissions);
  const d = maskTransactionRow(raw, !piiVisible);
  const donorEmail = piiVisible ? raw.donor.email : maskEmail(raw.donor.email);
  const donorPhone = raw.donor.phone ? (piiVisible ? raw.donor.phone : maskPhone(raw.donor.phone)) : null;
  const active = d.payments.find((p) => p.status === "paid" || p.status === "pending") ?? d.payments[0];

  const facts: [string, string][] = [
    ["Campaign", d.campaignTitle],
    ["Metode", d.methodName ? `${d.methodName} (${d.providerCode ?? "-"})` : "—"],
    ["Biaya gateway", active ? `${formatRupiah(active.feeAmount)} (ditanggung lembaga)` : "—"],
    ["Sumber", sourceLabel(d.source)],
    ["Anonim", d.isAnonymous ? "Ya (Hamba Allah)" : "Tidak"],
    ["Dibuat", t(d.createdAt)],
  ];

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin/transaksi" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-faint hover:text-primary">
            <ArrowLeft className="size-4" aria-hidden /> Transaksi
          </Link>
          <h1 className="font-mono text-xl font-bold break-all text-ink sm:text-2xl">{d.code}</h1>
          <p className="mt-1 text-sm text-ink-faint">Detail transaksi</p>
        </div>
        {hasPermission(ctx.permissions, "transactions.reconcile") ? <StatusCheckButton transactionId={d.id} /> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-3">
              <TrxStatusBadge status={d.status} />
              <span className="text-sm text-ink-faint">
                {d.paidAt ? `Dibayar ${t(d.paidAt)}` : "Belum dibayar"}
                {d.receiptNo ? ` · Kuitansi ${d.receiptNo}` : ""}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums" data-testid="trx-amount">
              {formatRupiah(d.amount)}
            </p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className="font-medium break-words">{v}</dd>
                </div>
              ))}
              {d.prayer ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-ink-faint">Doa</dt>
                  <dd className="font-medium break-words">“{d.prayer}”</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <Panel title="Percobaan pembayaran" description="Satu transaksi dapat memiliki beberapa percobaan; maksimal satu aktif">
            {d.payments.length === 0 ? (
              <p className="text-sm text-ink-faint">Belum ada percobaan pembayaran.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full text-sm" data-testid="payment-attempts">
                  <thead className="bg-muted/60 text-left text-xs text-ink-faint">
                    <tr>
                      {["Payment ID", "Metode", "Ref provider", "Status", "Kedaluwarsa", "Dibuat"].map((h) => (
                        <th key={h} scope="col" className="px-4 py-2 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {d.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap" title={p.id}>
                          {short(p.id)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{p.methodName}</td>
                        <td className="max-w-[160px] truncate px-4 py-2.5 font-mono text-xs">{p.providerRef ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <TrxStatusBadge status={p.status} />
                          {p.failureReason ? <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-ink-faint">{p.failureReason}</p> : null}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-ink-faint">{t(p.expiresAt)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-ink-faint">{t(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Event pembayaran"
            description="Webhook & pengecekan status (payload ter-redaksi di Log Pembayaran)"
            action={
              <Link href={`/admin/log-pembayaran?q=${d.code}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Semua log
              </Link>
            }
          >
            {d.events.length === 0 ? (
              <p className="text-sm text-ink-faint">Belum ada event.</p>
            ) : (
              <ol className="space-y-2" data-testid="payment-events">
                {d.events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
                    {e.result === "processed" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">
                        <Link href={`/admin/log-pembayaran?id=${e.id}`} className="font-mono hover:text-primary">
                          {e.eventType}
                        </Link>
                        {e.statusReported ? <span className="font-mono"> · {e.statusReported}</span> : null}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {t(e.receivedAt)} · verifikasi {e.verification} · hasil {e.result}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel title="Donatur">
            <p className="font-medium break-words">{raw.donor.anonymizedAt ? "Donatur dianonimkan" : raw.donor.name}</p>
            <p className="text-sm break-all text-ink-faint" data-testid="donor-email">
              {donorEmail}
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              {donorPhone ?? "WA tidak diisi"} · WA transaksi ini {d.whatsappOptIn ? "disetujui" : "tidak disetujui"}
            </p>
            <div className="mt-2">{raw.donor.hasAccount ? <Pill tone="success">Akun Google</Pill> : <Pill>Tamu</Pill>}</div>
            {hasPermission(ctx.permissions, "donors.read") ? (
              <Link href={`/admin/donatur?id=${raw.donor.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4 w-full" })}>
                Lihat profil donatur
              </Link>
            ) : null}
          </Panel>
          <Panel title="Notifikasi">
            {d.notifications.length === 0 ? (
              <p className="text-sm text-ink-faint">Belum ada notifikasi tercatat.</p>
            ) : (
              <ul className="space-y-2 text-sm" data-testid="trx-notifications">
                {d.notifications.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">
                        {n.channel === "whatsapp" ? "WA" : "Email"} · {n.event}
                      </span>
                      <span className="text-xs text-ink-faint">{t(n.sentAt ?? n.createdAt)}</span>
                    </span>
                    <Pill tone={n.status === "sent" ? "success" : n.status === "failed" ? "danger" : "neutral"}>{n.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="flex gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-sm" role="note">
            <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
            <p>
              <span className="font-semibold">Tidak ada aksi “tandai lunas”.</span> Status hanya berubah melalui verifikasi provider (BR-18, BR-41).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminTransactionDetailPage({ params }: PageProps<"/admin/transaksi/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Detail params={params} />
    </Suspense>
  );
}
