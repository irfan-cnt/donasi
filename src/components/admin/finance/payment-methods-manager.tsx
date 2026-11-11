"use client";

import { CreditCard, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ImageThumb, MoneyInput, moveItem, SortControls, UploadButton, useDragSort } from "@/components/admin/admin-form-client";
import { FieldError, FieldLabel, fieldClass } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { fillPlaceholders, instructionSectionsSchema } from "@/lib/payments/instruction-template";
import { cn } from "@/lib/utils";
import { reorderPaymentMethodsAction, savePaymentMethodAction, testProviderConnectionAction } from "@/server/actions/admin-finance-actions";

// Editor metode pembayaran (F-26). Urutan: drag & drop + tombol naik/turun (aksesibel keyboard).
// Instruksi per kanal: judul + langkah (satu baris = satu langkah) dengan placeholder
// {{va_number}} {{amount}} {{bank_name}} — disimpan sebagai teks biasa (tidak pernah HTML).

export interface MethodDto {
  id: string;
  code: string;
  providerCode: string;
  providerChannel: string;
  type: string;
  displayName: string;
  logoUrl: string | null;
  instructions: unknown;
  minAmount: string;
  maxAmount: string;
  expiryMinutes: number;
  feeFlat: string;
  feePercent: string;
  isActive: boolean;
}

const TYPE_LABEL: Record<string, string> = { qris: "QRIS", ewallet: "E-wallet", virtual_account: "Virtual Account", retail: "Gerai retail", card: "Kartu" };
const EXPIRY: [number, string][] = [
  [15, "15 menit"],
  [30, "30 menit"],
  [60, "1 jam"],
  [180, "3 jam"],
  [360, "6 jam"],
  [720, "12 jam"],
  [1440, "24 jam"],
  [2880, "2 hari"],
  [4320, "3 hari"],
];
const PLACEHOLDERS = ["va_number", "amount", "bank_name"] as const;
const SAMPLE = { va_number: "8808 1234 5678 9012", amount: "Rp100.000", bank_name: "BCA" };

interface SectionDraft {
  title: string;
  steps: string;
}

function toDrafts(raw: unknown): SectionDraft[] {
  const parsed = instructionSectionsSchema.safeParse(raw);
  return parsed.success ? parsed.data.map((s) => ({ title: s.title, steps: s.steps.join("\n") })) : [];
}

const stepsOf = (text: string) =>
  text
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

export function ConnectionTestButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const TEXT: Record<string, [boolean, string]> = {
    ok: [true, "Koneksi berhasil: kredensial diterima Midtrans."],
    invalid_credentials: [false, "Kredensial ditolak Midtrans (401). Periksa server key Midtrans di environment server."],
    unconfigured: [false, "Kredensial Midtrans belum diisi di environment server."],
    rate_limited: [false, "Terlalu sering. Coba lagi dalam beberapa menit."],
    error: [false, "Midtrans tidak dapat dihubungi. Coba lagi nanti."],
  };
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
        onClick={() =>
          start(async () => {
            const r = await testProviderConnectionAction();
            const [ok, text] = TEXT[r.result] ?? TEXT.error!;
            setMsg({ ok, text });
          })
        }
      >
        {pending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <KeyRound className="size-3" aria-hidden />}
        Tes koneksi
      </button>
      <p className={cn("mt-1 max-w-[220px] text-xs", msg?.ok ? "text-primary" : "text-danger")} role="status" aria-live="polite" data-testid="connection-result">
        {msg?.text}
      </p>
    </div>
  );
}

function MethodMark({ m }: { m: Pick<MethodDto, "logoUrl" | "displayName"> }) {
  if (m.logoUrl) return <ImageThumb url={m.logoUrl} alt="" className="size-10 shrink-0" />;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-ink-soft" aria-hidden>
      {m.displayName.slice(0, 3).toUpperCase()}
    </span>
  );
}

export function PaymentMethodsManager({ methods }: { methods: MethodDto[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(methods.map((m) => m.id));
  const [selected, setSelected] = useState(methods[0]?.id ?? null);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [savingOrder, startOrder] = useTransition();
  const byId = useMemo(() => new Map(methods.map((m) => [m.id, m])), [methods]);
  const dirtyOrder = order.join() !== methods.map((m) => m.id).join();
  const onMove = (from: number, to: number) => setOrder((o) => moveItem(o, from, to));
  const drag = useDragSort(onMove);
  const current = selected ? byId.get(selected) : undefined;

  if (methods.length === 0) {
    return <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-faint">Belum ada metode pembayaran (jalankan seed referensi).</p>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      <section className="min-w-0 rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 className="font-semibold text-ink">Daftar metode</h2>
            <p className="mt-0.5 text-xs text-ink-faint">Seret atau pakai tombol panah untuk mengubah urutan tampil</p>
          </div>
          {dirtyOrder ? (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOrder(methods.map((m) => m.id))}>
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={savingOrder}
                onClick={() =>
                  startOrder(async () => {
                    const r = await reorderPaymentMethodsAction(order);
                    setOrderMsg(r.ok ? "Urutan disimpan." : r.error);
                    if (r.ok) router.refresh();
                  })
                }
              >
                Simpan urutan
              </Button>
            </div>
          ) : null}
        </div>
        {orderMsg ? (
          <p className="px-5 pb-2 text-xs text-ink-faint" role="status">
            {orderMsg}
          </p>
        ) : null}
        <ul className="divide-y divide-border border-t border-border" data-testid="method-list">
          {order.map((id, i) => {
            const m = byId.get(id)!;
            return (
              <li key={id} {...drag.itemProps(i)} className={cn("flex items-center gap-3 px-3 py-3 sm:px-5", selected === id && "bg-primary-soft/40", drag.over === i && "outline-2 outline-primary")}>
                <SortControls index={i} count={order.length} onMove={onMove} label={m.displayName} />
                <button type="button" onClick={() => setSelected(id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-pressed={selected === id}>
                  <MethodMark m={m} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.displayName}</span>
                    <span className="block truncate text-xs text-ink-faint">
                      {TYPE_LABEL[m.type] ?? m.type} · {m.providerCode}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.isActive ? "bg-primary-soft text-primary-ink" : "bg-muted text-ink-faint")}>{m.isActive ? "Aktif" : "Nonaktif"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {current ? <MethodEditor key={current.id} method={current} onSaved={() => router.refresh()} /> : null}
    </div>
  );
}

function MethodEditor({ method, onSaved }: { method: MethodDto; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(method.displayName);
  const [logoUrl, setLogoUrl] = useState(method.logoUrl);
  const [isActive, setIsActive] = useState(method.isActive);
  const [minAmount, setMinAmount] = useState(method.minAmount);
  const [maxAmount, setMaxAmount] = useState(method.maxAmount);
  const [expiry, setExpiry] = useState(method.expiryMinutes);
  const [feeFlat, setFeeFlat] = useState(method.feeFlat === "0" ? "" : method.feeFlat);
  const [feePercent, setFeePercent] = useState(method.feePercent);
  const [sections, setSections] = useState<SectionDraft[]>(() => toDrafts(method.instructions));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(false);
  const expiryOptions = EXPIRY.some(([v]) => v === expiry) ? EXPIRY : [...EXPIRY, [expiry, `${expiry} menit`] as [number, string]];

  const updateSection = (i: number, patch: Partial<SectionDraft>) => setSections((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const insertPlaceholder = (i: number, name: string) => updateSection(i, { steps: `${sections[i]!.steps}{{${name}}}` });

  function save() {
    setMsg(null);
    start(async () => {
      const r = await savePaymentMethodAction(method.id, {
        displayName,
        logoUrl,
        isActive,
        minAmount,
        maxAmount,
        expiryMinutes: expiry,
        feeFlat,
        feePercent,
        instructions: sections.map((s) => ({ title: s.title.trim(), steps: stepsOf(s.steps) })),
      });
      if (r.ok) {
        setErrors({});
        setMsg({ ok: true, text: "Perubahan disimpan." });
        onSaved();
      } else {
        setErrors(r.fieldErrors ?? {});
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label={`Ubah ${method.displayName}`} data-testid="method-editor">
      <div className="flex items-center gap-3">
        <MethodMark m={{ logoUrl, displayName }} />
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{method.displayName}</h2>
          <p className="truncate text-xs text-ink-faint">
            Kode: {method.code} · kanal provider: {method.providerChannel}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm font-medium">
          Tampilkan ke donatur
          <input type="checkbox" role="switch" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 accent-primary" aria-label="Tampilkan ke donatur" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="pm-name">Nama tampil</FieldLabel>
            <input id="pm-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={fieldClass} aria-invalid={!!errors.displayName} />
            <FieldError>{errors.displayName}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="pm-min">Min. nominal</FieldLabel>
            <MoneyInput id="pm-min" value={minAmount} onChange={setMinAmount} />
            <FieldError>{errors.minAmount}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="pm-max" optional>
              Maks. nominal
            </FieldLabel>
            <MoneyInput id="pm-max" value={maxAmount} onChange={setMaxAmount} />
            <FieldError>{errors.maxAmount}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="pm-exp">Masa berlaku</FieldLabel>
            <select id="pm-exp" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className={fieldClass}>
              {expiryOptions.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <FieldError>{errors.expiryMinutes}</FieldError>
          </div>
          <div>
            <FieldLabel>Logo</FieldLabel>
            <div className="flex gap-2">
              <UploadButton label={logoUrl ? "Ganti" : "Unggah"} onUploaded={(img) => setLogoUrl(img.url)} />
              {logoUrl ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => setLogoUrl(null)} aria-label="Hapus logo">
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </div>
            <FieldError>{errors.logoUrl}</FieldError>
          </div>
        </div>

        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">Biaya gateway</legend>
          <p className="text-xs text-ink-faint">Ditanggung lembaga (OD-04) — donatur membayar nominal tepat. Diisi untuk pencatatan biaya.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="pm-fee-flat" optional>
                Biaya tetap
              </FieldLabel>
              <MoneyInput id="pm-fee-flat" value={feeFlat} onChange={setFeeFlat} />
              <FieldError>{errors.feeFlat}</FieldError>
            </div>
            <div>
              <FieldLabel htmlFor="pm-fee-pct">Biaya persen (%)</FieldLabel>
              <input id="pm-fee-pct" inputMode="decimal" value={feePercent} onChange={(e) => setFeePercent(e.target.value.replace(",", "."))} className={fieldClass} aria-invalid={!!errors.feePercent} />
              <FieldError>{errors.feePercent}</FieldError>
            </div>
          </div>
        </fieldset>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Instruksi per kanal</p>
            <button type="button" className="text-xs font-semibold text-primary" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? "Kembali ke editor" : "Pratinjau"}
            </button>
          </div>
          <p className="mt-0.5 text-xs text-ink-faint">Satu baris = satu langkah. Placeholder diisi otomatis saat donatur membayar.</p>
          {preview ? (
            <div className="mt-2 space-y-3 rounded-xl bg-muted/60 p-3 text-sm" data-testid="instruction-preview">
              {sections.length === 0 ? <p className="text-ink-faint">Belum ada instruksi.</p> : null}
              {sections.map((s, i) => (
                <div key={i}>
                  <p className="font-semibold">{fillPlaceholders(s.title, SAMPLE) || "(tanpa judul)"}</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    {stepsOf(s.steps).map((st, j) => (
                      <li key={j} className="break-words">
                        {fillPlaceholders(st, SAMPLE)}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              {sections.map((s, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <div className="flex gap-2">
                    <input value={s.title} onChange={(e) => updateSection(i, { title: e.target.value })} placeholder="Nama kanal, mis. m-Banking" aria-label={`Judul kanal ${i + 1}`} className={fieldClass} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSections((x) => x.filter((_, j) => j !== i))} aria-label={`Hapus kanal ${i + 1}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <textarea value={s.steps} onChange={(e) => updateSection(i, { steps: e.target.value })} rows={4} aria-label={`Langkah kanal ${i + 1}`} className={cn(fieldClass, "mt-2 h-auto py-2 font-mono text-xs")} />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {PLACEHOLDERS.map((p) => (
                      <button key={p} type="button" onClick={() => insertPlaceholder(i, p)} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-ink-soft hover:bg-primary-soft">
                        {`{{${p}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {sections.length < 10 ? (
                <button type="button" onClick={() => setSections((x) => [...x, { title: "", steps: "" }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  <Plus className="size-3.5" aria-hidden /> Tambah kanal (ATM, internet banking, …)
                </button>
              ) : null}
              {Object.entries(errors)
                .filter(([k]) => k.startsWith("instructions"))
                .slice(0, 1)
                .map(([k, v]) => (
                  <FieldError key={k}>Instruksi: {v}</FieldError>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="button" onClick={save} disabled={pending} className="flex-1">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
          Simpan
        </Button>
        <p className={cn("w-full text-xs", msg?.ok ? "text-primary" : "text-danger")} role="status" aria-live="polite">
          {msg?.text}
        </p>
      </div>
    </section>
  );
}
