import { useEffect, useState } from 'react';
import { ChevronDown, Clock, Download, ExternalLink, Loader2, RefreshCw, TimerOff } from 'lucide-react';
import { paymentMethods } from '@/data/sample';
import { cn, rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { FlowLayout } from '@/components/public/layout';
import { CopyField } from '@/components/public/campaign';
import { Alert, Button, Card } from '@/components/ui/primitives';
import { EmptyState, MethodMark } from '@/components/ui/shared';

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => { const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/** Pola QR ilustratif (bukan QR yang dapat dipindai) */
function FakeQR() {
  const n = 25;
  const cells: JSX.Element[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    if (rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  }
  const F = ({ x, y }: { x: number; y: number }) => (<g><rect x={x} y={y} width="7" height="7" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>);
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} className="h-56 w-56" role="img" aria-label="Kode QRIS (contoh)">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <g fill="#111">{cells}<F x={0} y={0} /><F x={n - 7} y={0} /><F x={0} y={n - 7} /></g>
    </svg>
  );
}

const vaSteps = [
  { title: 'm-Banking (BCA mobile)', steps: ['Buka BCA mobile, pilih m-Transfer → BCA Virtual Account.', 'Masukkan nomor Virtual Account di atas.', 'Pastikan nama penerima “Yayasan Tebar Kebaikan” dan nominal sesuai.', 'Masukkan PIN m-BCA untuk menyelesaikan pembayaran.'] },
  { title: 'ATM BCA', steps: ['Masukkan kartu & PIN.', 'Pilih Transaksi Lainnya → Transfer → ke Rek BCA Virtual Account.', 'Masukkan nomor Virtual Account, lalu konfirmasi.'] },
  { title: 'KlikBCA (internet banking)', steps: ['Login KlikBCA Individual.', 'Pilih Transfer Dana → Transfer ke BCA Virtual Account.', 'Masukkan nomor VA dan ikuti instruksi.'] },
];

export default function PaymentInstructionPage({ kind = 'va' }: { kind?: 'va' | 'qris' | 'ewallet' }) {
  const state = useMockState();
  const amount = 100_000;
  const method = paymentMethods.find((m) => m.code === (kind === 'va' ? 'bca_va' : kind === 'qris' ? 'qris' : 'gopay'))!;
  const countdown = useCountdown(kind === 'va' ? 23 * 3600 + 59 * 60 + 12 : 14 * 60 + 48);
  const [open, setOpen] = useState(0);
  const expired = state === 'error';

  return (
    <FlowLayout title="Selesaikan Pembayaran" step={3} footer={!expired && (
      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={() => go('select-payment')}>Ganti Metode</Button>
        <Button size="lg" className="flex-1" onClick={() => go('payment-success')}><RefreshCw className="h-4 w-4" />Cek Status</Button>
      </div>
    )}>
      {expired ? (
        <EmptyState icon={TimerOff} title="Waktu pembayaran habis" description="Pembayaran ini sudah kedaluwarsa dan tidak bisa dibayar lagi. Jangan khawatir, kamu bisa membuat pembayaran baru untuk donasi yang sama." action={<Button onClick={() => go('select-payment')}>Buat pembayaran baru</Button>} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between bg-warning-soft px-4 py-2.5 text-sm text-warning">
              <span className="flex items-center gap-1.5 font-medium"><Clock className="h-4 w-4" />Bayar sebelum</span>
              <span className="tabular font-mono font-bold" aria-live="polite">{countdown}</span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3"><MethodMark name={method.name} color={method.color} /><div><p className="text-sm font-semibold">{method.name}</p><p className="text-xs text-ink-faint">Kode transaksi TK-261109-7QF3KD</p></div></div>

              {kind === 'va' && (
                <div className="mt-4 space-y-3">
                  <CopyField label="Nomor Virtual Account" value="1234500812345678" display="12345 0081 2345 678" mono />
                  <CopyField label="Total pembayaran" value={String(amount)} display={rupiah(amount)} />
                  <p className="text-xs text-ink-faint">Transfer <strong>tepat</strong> sesuai nominal. Nama penerima: Yayasan Tebar Kebaikan.</p>
                </div>
              )}

              {kind === 'qris' && (
                <div className="mt-4 flex flex-col items-center">
                  <div className="rounded-2xl border border-border p-3"><FakeQR /></div>
                  <p className="tabular mt-3 text-2xl font-bold text-primary-ink">{rupiah(amount)}</p>
                  <p className="mt-1 text-center text-xs text-ink-faint">Pindai dengan aplikasi m-banking atau e-wallet yang mendukung QRIS</p>
                  <Button variant="outline" size="sm" className="mt-3"><Download className="h-4 w-4" />Unduh QR</Button>
                </div>
              )}

              {kind === 'ewallet' && (
                <div className="mt-4 text-center">
                  <p className="tabular text-2xl font-bold text-primary-ink">{rupiah(amount)}</p>
                  <p className="mt-1 text-sm text-ink-faint">Lanjutkan pembayaran di aplikasi {method.name}</p>
                  <Button size="lg" block className="mt-4"><ExternalLink className="h-4 w-4" />Buka {method.name}</Button>
                  <p className="mt-2 text-xs text-ink-faint">Tidak terbuka otomatis? Pastikan aplikasi {method.name} terpasang di HP ini.</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-2.5 text-xs text-ink-faint">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />Menunggu konfirmasi pembayaran otomatis…
            </div>
          </Card>

          {kind === 'va' && (
            <section className="mt-5">
              <h2 className="font-semibold">Cara pembayaran</h2>
              <div className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {vaSteps.map((s, i) => (
                  <div key={s.title}>
                    <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium" aria-expanded={open === i}>{s.title}<ChevronDown className={cn('h-4 w-4 transition', open === i && 'rotate-180')} /></button>
                    {open === i && <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-8 text-sm text-ink-soft">{s.steps.map((t) => <li key={t}>{t}</li>)}</ol>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <Alert className="mt-5" tone="info" title="Status diperbarui otomatis">Halaman ini akan berpindah sendiri setelah pembayaran terkonfirmasi. Instruksi juga sudah kami kirim ke email-mu.</Alert>
        </>
      )}
    </FlowLayout>
  );
}
