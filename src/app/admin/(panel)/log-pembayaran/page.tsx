import type { Metadata } from "next";
import { ExternalLink, ScrollText, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pager, Pill } from "@/components/admin/finance/pager";
import { fieldClass } from "@/components/admin/form-bits";
import { formatWibDateTime } from "@/components/donor/format";
import { EmptyState } from "@/components/public/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { formatRupiah } from "@/lib/money";
import { redactEventPayload } from "@/lib/payments/redact-event";
import { cn } from "@/lib/utils";
import { EVENT_RESULTS, FINANCE_PAGE_SIZE, PAYMENT_EVENT_TYPES, paymentEventQuery } from "@/lib/validation/admin-finance";
import { findPaymentEvent, listPaymentEvents } from "@/server/repositories/admin-finance-repository";

export const metadata: Metadata = { title: "Log Pembayaran — Admin Tebar Kebaikan" };

const resultTone = (r: string) => (r === "processed" ? "success" : r === "duplicate" || r === "received" ? "info" : "danger");
const verifTone = (v: string) => (v === "verified" ? "success" : v === "pending" ? "neutral" : "danger");

// Log pembayaran (F-29): payment_events (append-only) dengan filter & detail JSON ter-redaksi.
async function Logs({ searchParams }: { searchParams: PageProps<"/admin/log-pembayaran">["searchParams"] }) {
  await requireAdmin("transactions.read");
  const q = paymentEventQuery.parse(await searchParams);
  const [{ rows, total }, detail] = await Promise.all([listPaymentEvents(q), q.id ? findPaymentEvent(q.id) : null]);
  const filters = { q: q.q, tipe: q.tipe, verifikasi: q.verifikasi, hasil: q.hasil };
  const filtered = Object.values(filters).some(Boolean);
  const link = (id: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, hal: q.hal > 1 ? String(q.hal) : undefined, id })) if (v) sp.set(k, v);
    return `/admin/log-pembayaran?${sp.toString()}`;
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Log Pembayaran</h1>
        <p className="mt-1 text-sm text-ink-faint">Webhook, request, dan pengecekan status dari Midtrans (append-only)</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface">
          <form method="get" className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Filter log pembayaran">
            <div className="relative min-w-0 flex-[1_1_220px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input name="q" defaultValue={q.q ?? ""} placeholder="Kode transaksi, order id, atau ref provider…" aria-label="Cari event" className={cn(fieldClass, "pl-9")} />
            </div>
            <select name="tipe" defaultValue={q.tipe ?? ""} aria-label="Filter tipe" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
              <option value="">Semua tipe</option>
              {PAYMENT_EVENT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select name="verifikasi" defaultValue={q.verifikasi ?? ""} aria-label="Filter verifikasi" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
              <option value="">Semua verifikasi</option>
              {["pending", "verified", "rejected"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select name="hasil" defaultValue={q.hasil ?? ""} aria-label="Filter hasil" className={cn(fieldClass, "w-auto flex-[1_1_140px]")}>
              <option value="">Semua hasil</option>
              {EVENT_RESULTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit" size="lg" variant="secondary">
                Terapkan
              </Button>
              {filtered ? (
                <Link href="/admin/log-pembayaran" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
          {rows.length === 0 ? (
            <EmptyState icon={ScrollText} title="Belum ada event" description={filtered ? "Coba ubah filter." : "Event muncul setelah ada pembayaran."} />
          ) : (
            <>
              <ul className="divide-y divide-border" data-testid="event-rows">
                {rows.map((e) => (
                  <li key={e.id}>
                    <Link href={link(e.id)} scroll={false} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-muted/40", q.id === e.id && "bg-primary-soft/40")}>
                      <span className="min-w-0 flex-[1_1_220px]">
                        <span className="block font-mono text-xs font-semibold">
                          {e.eventType}
                          {e.statusReported ? ` · ${e.statusReported}` : ""}
                        </span>
                        <span className="block truncate text-xs text-ink-faint">
                          {formatWibDateTime(e.receivedAt)} · {e.transactionCode ?? "tanpa transaksi"}
                        </span>
                      </span>
                      <Pill tone={verifTone(e.verification)}>{e.verification}</Pill>
                      <Pill tone={resultTone(e.result)}>{e.result}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pager basePath="/admin/log-pembayaran" params={filters} page={q.hal} total={total} pageSize={FINANCE_PAGE_SIZE} noun="event" />
            </>
          )}
        </section>
        <aside className="min-w-0 rounded-2xl border border-border bg-surface p-5" aria-label="Detail event" data-testid="event-detail">
          {!detail ? (
            <p className="text-sm text-ink-faint">{q.id ? "Event tidak ditemukan." : "Pilih event untuk melihat payload (ter-redaksi)."}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Detail event</h2>
                <Pill tone={resultTone(detail.result)}>{detail.result}</Pill>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Provider", detail.providerCode],
                  ["Tipe", detail.eventType],
                  ["Verifikasi", detail.verification],
                  ["Dilaporkan", detail.statusReported ?? "—"],
                  ["Nominal", detail.amountReported === null ? "—" : formatRupiah(detail.amountReported)],
                  ["Diterima", formatWibDateTime(detail.receivedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-ink-faint">{k}</dt>
                    <dd className="font-medium break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              {detail.errorMessage ? <p className="mt-3 rounded-lg bg-danger-soft p-3 text-xs break-words text-danger">{detail.errorMessage.slice(0, 500)}</p> : null}
              <pre className="mt-4 max-h-[480px] overflow-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-surface" data-testid="event-payload">
                {JSON.stringify(redactEventPayload(detail.payload), null, 2)}
              </pre>
              {detail.transactionId ? (
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

export default function AdminPaymentLogsPage({ searchParams }: PageProps<"/admin/log-pembayaran">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Logs searchParams={searchParams} />
    </Suspense>
  );
}
