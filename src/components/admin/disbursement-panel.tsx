"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addDisbursementAction, deleteDisbursementAction } from "@/server/actions/admin-campaign-actions";
import { formatDigits, MoneyInput } from "./admin-form-client";
import { FieldError, FieldLabel, fieldClass, Panel } from "./form-bits";

export const DISBURSEMENT_KIND_LABEL = { program: "Program", operational: "Operasional", bank_fee: "Biaya bank" } as const;

export interface DisbursementItem {
  id: string;
  amount: string;
  kind: keyof typeof DISBURSEMENT_KIND_LABEL;
  description: string;
  disbursedAt: string;
  newsTitle: string | null;
}

// Rincian penyaluran dana (OD-06, BR-43) — permission disbursements.write (finance/admin/owner).
export function DisbursementPanel({
  campaignId,
  items,
  totalLabel,
  remainingLabel,
  newsOptions,
  today,
}: {
  campaignId: string;
  items: DisbursementItem[];
  totalLabel: string;
  remainingLabel: string;
  newsOptions: { id: string; title: string }[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", kind: "program", description: "", disbursedAt: today, newsId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      const res = await addDisbursementAction({ ...form, campaignId, newsId: form.newsId || null });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setError(res.error);
        return;
      }
      setErrors({});
      setForm({ amount: "", kind: "program", description: "", disbursedAt: today, newsId: "" });
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("Hapus catatan penyaluran ini? (soft delete, tetap tercatat di audit log)")) return;
    start(async () => {
      const res = await deleteDisbursementAction(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Panel
      title="Penyaluran dana"
      description={`Tersalurkan ${totalLabel} · sisa ${remainingLabel}`}
      action={
        <Button type="button" variant="ghost" size="icon" aria-label="Tambah penyaluran" onClick={() => setOpen((o) => !o)}>
          <Plus aria-hidden />
        </Button>
      }
    >
      {open ? (
        <div className="mb-4 space-y-3 rounded-xl border border-border p-3" data-testid="disbursement-form">
          <div>
            <FieldLabel htmlFor="d-amount">Nominal</FieldLabel>
            <MoneyInput id="d-amount" value={form.amount} onChange={(d) => setForm({ ...form, amount: d })} invalid={!!errors.amount} />
            <FieldError>{errors.amount}</FieldError>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <FieldLabel htmlFor="d-kind">Jenis</FieldLabel>
              <select id="d-kind" className={fieldClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {Object.entries(DISBURSEMENT_KIND_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <FieldLabel htmlFor="d-date">Tanggal</FieldLabel>
              <input id="d-date" type="date" className={fieldClass} value={form.disbursedAt} onChange={(e) => setForm({ ...form, disbursedAt: e.target.value })} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="d-desc">Keterangan</FieldLabel>
            <textarea id="d-desc" rows={2} maxLength={500} className={cn(fieldClass, "h-auto py-2")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <FieldError>{errors.description}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="d-news" optional>
              Berita bukti
            </FieldLabel>
            <select id="d-news" className={fieldClass} value={form.newsId} onChange={(e) => setForm({ ...form, newsId: e.target.value })}>
              <option value="">Tanpa tautan berita</option>
              {newsOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="button" size="lg" className="w-full" disabled={pending} onClick={submit}>
            {pending ? "Menyimpan…" : "Simpan penyaluran"}
          </Button>
        </div>
      ) : error ? (
        <p className="mb-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {items.length ? (
        <ul className="divide-y divide-border text-sm">
          {items.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-semibold tabular-nums">Rp{formatDigits(d.amount)}</p>
                <p className="text-xs text-ink-faint">
                  {DISBURSEMENT_KIND_LABEL[d.kind]} · {d.disbursedAt}
                </p>
                <p className="mt-0.5 text-xs break-words text-ink-soft">{d.description}</p>
                {d.newsTitle ? <p className="mt-0.5 truncate text-xs text-primary">Bukti: {d.newsTitle}</p> : null}
              </div>
              <button type="button" aria-label="Hapus penyaluran" className="rounded p-1 text-ink-faint hover:text-danger" disabled={pending} onClick={() => remove(d.id)}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">Belum ada catatan penyaluran.</p>
      )}
    </Panel>
  );
}
