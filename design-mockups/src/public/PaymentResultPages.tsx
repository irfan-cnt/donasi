import { CheckCircle2, Download, Hourglass, Loader2, LogIn, Mail, RefreshCw, Share2, XCircle } from 'lucide-react';
import { campaigns } from '@/data/sample';
import { rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { FlowLayout } from '@/components/public/layout';
import { Alert, Button, Card } from '@/components/ui/primitives';

function Summary({ status }: { status: 'paid' | 'pending' }) {
  const rows: [string, string][] = [
    ['Kode transaksi', 'TK-261109-7QF3KD'],
    ['Program', campaigns[0].title],
    ['Metode', 'BCA Virtual Account'],
    [status === 'paid' ? 'Dibayar' : 'Dibuat', status === 'paid' ? '9 Nov 2026, 08.15 WIB' : '9 Nov 2026, 08.14 WIB'],
  ];
  return (
    <Card className="mt-6 p-4 text-left">
      <dl className="space-y-2.5 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="shrink-0 text-ink-faint">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        <div className="flex justify-between border-t border-dashed border-border pt-2.5"><dt className="font-semibold">Nominal</dt><dd className="tabular text-lg font-bold text-primary-ink">{rupiah(100_000)}</dd></div>
      </dl>
    </Card>
  );
}

export function PaymentSuccessPage({ guest = true }: { guest?: boolean }) {
  const state = useMockState();
  if (state === 'loading') return <FlowLayout title="Donasi Berhasil"><div className="flex flex-col items-center py-20 text-ink-faint"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm">Memverifikasi pembayaran…</p></div></FlowLayout>;
  return (
    <FlowLayout title="Donasi Berhasil">
      <div className="text-center">
        <div className="relative mx-auto mt-4 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-success-soft pattern-islamic-dark" />
          <CheckCircle2 className="relative h-14 w-14 text-success" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">Jazakallah khairan, Ahmad!</h1>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">Donasimu telah kami terima. Semoga Allah membalas kebaikanmu dengan pahala yang terus mengalir.</p>
        <Summary status="paid" />
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-faint"><Mail className="h-3.5 w-3.5" />Kuitansi telah dikirim ke ah***@example.com</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="lg"><Download className="h-4 w-4" />Unduh Kuitansi (PDF)</Button>
          <Button variant="secondary" size="lg"><Share2 className="h-4 w-4" />Ajak Teman Berdonasi</Button>
        </div>
        {guest && (
          <Card className="mt-6 border-primary/20 bg-primary-soft/50 p-4 text-left">
            <p className="font-semibold">Simpan riwayat donasimu</p>
            <p className="mt-1 text-sm text-ink-soft">Masuk dengan Google memakai email yang sama untuk melihat semua donasi dan mengunduh kuitansi kapan saja.</p>
            <Button className="mt-3" onClick={() => go('donor-login')}><LogIn className="h-4 w-4" />Masuk dengan Google</Button>
          </Card>
        )}
        <Button variant="ghost" className="mt-4" onClick={() => go('home')}>Kembali ke Beranda</Button>
      </div>
    </FlowLayout>
  );
}

export function PaymentPendingPage() {
  const state = useMockState();
  const failed = state === 'error';
  return (
    <FlowLayout title={failed ? 'Pembayaran Gagal' : 'Menunggu Pembayaran'}>
      <div className="text-center">
        <div className={`mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full ${failed ? 'bg-danger-soft' : 'bg-warning-soft'}`}>
          {failed ? <XCircle className="h-12 w-12 text-danger" strokeWidth={1.75} /> : <Hourglass className="h-12 w-12 text-warning" strokeWidth={1.75} />}
        </div>
        <h1 className="mt-5 text-2xl font-bold">{failed ? 'Pembayaran belum berhasil' : 'Pembayaranmu sedang kami tunggu'}</h1>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">
          {failed ? 'Transaksi ditolak oleh penyedia pembayaran. Saldo kamu tidak terpotong. Silakan coba metode lain.' : 'Jika kamu sudah membayar, konfirmasi biasanya masuk dalam 1–5 menit. Halaman ini memperbarui status secara otomatis.'}
        </p>
        {!failed && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-ink-faint"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />Mengecek status · terakhir 08.16.04 WIB</p>}
        <Summary status="pending" />
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {failed ? (
            <Button size="lg" className="sm:col-span-2" onClick={() => go('select-payment')}>Pilih metode lain</Button>
          ) : (
            <>
              <Button variant="outline" size="lg" onClick={() => go('instruction-va')}>Lihat Instruksi</Button>
              <Button size="lg" onClick={() => go('payment-success')}><RefreshCw className="h-4 w-4" />Cek Status</Button>
            </>
          )}
        </div>
        <Alert className="mt-6 text-left" tone="info" title="Sudah bayar tapi status belum berubah?">Simpan bukti bayar, lalu hubungi kami di halo@tebarkebaikan.org dengan menyertakan kode transaksi.</Alert>
      </div>
    </FlowLayout>
  );
}
