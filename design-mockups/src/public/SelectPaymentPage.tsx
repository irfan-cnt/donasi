import { useState } from 'react';
import { ChevronRight, Clock, Loader2 } from 'lucide-react';
import { campaigns, paymentMethods, type PayMethod } from '@/data/sample';
import { cn, rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { FlowLayout } from '@/components/public/layout';
import { Alert, Button, Card, Skeleton } from '@/components/ui/primitives';
import { EmptyState, MethodMark } from '@/components/ui/shared';

const groups: { key: PayMethod['group']; title: string; hint: string }[] = [
  { key: 'QRIS', title: 'QRIS', hint: 'Bayar dari aplikasi bank atau e-wallet apa pun' },
  { key: 'E-Wallet', title: 'E-Wallet', hint: 'Diarahkan ke aplikasi e-wallet' },
  { key: 'Virtual Account', title: 'Virtual Account', hint: 'Transfer bank, terverifikasi otomatis' },
  { key: 'Bill Payment', title: 'Mandiri Bill Payment', hint: 'Bayar lewat Livin’ by Mandiri atau ATM Mandiri' },
];

export default function SelectPaymentPage() {
  const state = useMockState();
  const c = campaigns[0];
  const amount = 100_000;
  const [sel, setSel] = useState('qris');
  const methods = state === 'empty' ? [] : paymentMethods.filter((m) => m.active);

  return (
    <FlowLayout
      title="Pilih Pembayaran"
      back="checkout-open"
      step={2}
      footer={methods.length > 0 && (
        <Button size="lg" block disabled={state === 'loading'} onClick={() => go(sel.endsWith('_va') ? 'instruction-va' : sel === 'qris' ? 'instruction-qris' : 'instruction-ewallet')}>
          {state === 'loading' ? <><Loader2 className="h-4 w-4 animate-spin" />Membuat pembayaran…</> : <>Bayar {rupiah(amount)}</>}
        </Button>
      )}
    >
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm"><span className="text-ink-faint">Kode transaksi</span><span className="font-mono font-semibold">TK-261109-7QF3KD</span></div>
        <div className="mt-2 flex items-start justify-between gap-4 text-sm"><span className="text-ink-faint">Program</span><span className="text-right font-medium">{c.title}</span></div>
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-border pt-3"><span className="font-semibold">Total</span><span className="tabular text-xl font-bold text-primary-ink">{rupiah(amount)}</span></div>
        <p className="mt-1 text-right text-xs text-ink-faint">Tanpa biaya tambahan</p>
      </Card>

      {state === 'error' && <Alert className="mt-4" tone="danger" title="Gagal membuat pembayaran">Layanan pembayaran sedang sibuk. Silakan pilih metode lain atau coba lagi dalam beberapa saat.</Alert>}

      {state === 'loading' && <div className="mt-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>}

      {state !== 'loading' && methods.length === 0 && (
        <EmptyState icon={Clock} title="Metode pembayaran belum tersedia" description="Kami sedang melakukan pemeliharaan sistem pembayaran. Coba lagi beberapa saat lagi." />
      )}

      {state !== 'loading' && groups.map((g) => {
        const items = methods.filter((m) => m.group === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key} className="mt-5">
            <h2 className="text-sm font-semibold">{g.title}</h2>
            <p className="text-xs text-ink-faint">{g.hint}</p>
            <div className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface" role="radiogroup" aria-label={g.title}>
              {items.map((m) => (
                <button key={m.code} role="radio" aria-checked={sel === m.code} onClick={() => setSel(m.code)} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition', sel === m.code ? 'bg-primary-soft/60' : 'hover:bg-muted')}>
                  <MethodMark name={m.name} color={m.color} />
                  <span className="flex-1"><span className="block text-sm font-medium">{m.name}</span><span className="block text-xs text-ink-faint">Berlaku {m.expiry}</span></span>
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2', sel === m.code ? 'border-primary bg-primary' : 'border-border')}>{sel === m.code && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <button className="mt-5 flex w-full items-center justify-between rounded-xl px-1 text-sm text-ink-faint">Butuh bantuan? Hubungi kami <ChevronRight className="h-4 w-4" /></button>
    </FlowLayout>
  );
}
