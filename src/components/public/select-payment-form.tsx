"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPaymentAction, type PaymentFormState } from "@/server/actions/payments";

export interface MethodOption {
  code: string;
  name: string;
  expiry: string;
}

export interface MethodGroupView {
  key: string;
  title: string;
  hint: string;
  methods: MethodOption[];
}

/** Pilihan metode (mockup SelectPaymentPage): radio per grup + CTA "Bayar …" fixed di bawah. */
export function SelectPaymentForm({
  slug,
  trx,
  token,
  groups,
  initialMethod,
  amountLabel,
}: {
  slug: string;
  trx: string;
  token: string;
  groups: MethodGroupView[];
  initialMethod: string | null;
  amountLabel: string;
}) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(createPaymentAction, {});
  const all = groups.flatMap((g) => g.methods.map((m) => m.code));
  const [selected, setSelected] = useState(
    initialMethod && all.includes(initialMethod) ? initialMethod : (all[0] ?? ""),
  );

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="trx" value={trx} />
      <input type="hidden" name="t" value={token} />

      {state.error && (
        <Alert variant="destructive" className="mt-4" data-testid="payment-error">
          <AlertTitle>Gagal membuat pembayaran</AlertTitle>
          <AlertDescription>
            {state.error}
            {state.reference && <span className="mt-1 block text-xs">Kode referensi: {state.reference}</span>}
          </AlertDescription>
        </Alert>
      )}

      {groups.map((g) => (
        <fieldset key={g.key} className="mt-5 min-w-0">
          <legend className="text-sm font-semibold">{g.title}</legend>
          <p className="text-xs text-ink-faint">{g.hint}</p>
          <div className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {g.methods.map((m) => {
              const checked = selected === m.code;
              return (
                <label
                  key={m.code}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-3 transition",
                    checked ? "bg-primary-soft/60" : "hover:bg-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-bg text-[10px] font-bold text-primary-ink"
                  >
                    {m.name.split(" ")[0]!.slice(0, 7)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{m.name}</span>
                    <span className="block text-xs text-ink-faint">Berlaku {m.expiry}</span>
                  </span>
                  <input
                    type="radio"
                    name="method"
                    value={m.code}
                    checked={checked}
                    onChange={() => setSelected(m.code)}
                    className="size-5 shrink-0 accent-primary"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending || !selected}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Membuat pembayaran…
              </>
            ) : (
              <>Bayar {amountLabel}</>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
