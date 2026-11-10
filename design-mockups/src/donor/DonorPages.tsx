import { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronRight, Clock, Download, FileText, HandCoins, HeartHandshake, Loader2, ReceiptText, ShieldCheck } from 'lucide-react';
import { campaigns, transactions, type TrxStatus } from '@/data/sample';
import { cn, rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { DonorShell } from '@/components/donor/DonorShell';
import { CampaignCard } from '@/components/public/campaign';
import { Logo, EmptyState, ErrorState, ListSkeleton, Stat, TrxStatusBadge } from '@/components/ui/shared';
import { Alert, Button, Card, CardHeader, Input, Label, Select, Skeleton, Switch } from '@/components/ui/primitives';

const mine = transactions.filter((t) => ['Ahmad Fauzi'].includes(t.donor)).concat(transactions.slice(1, 6).map((t) => ({ ...t, donor: 'Ahmad Fauzi' })));

/* ================= Login ================= */
export function DonorLoginPage() {
  const state = useMockState();
  return (
    <div className="grid min-h-screen bg-bg md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary-ink p-10 text-white md:flex md:flex-col md:justify-between">
        <div className="pattern-islamic absolute inset-0" />
        <div className="relative"><Logo light /></div>
        <div className="relative">
          <p className="font-display text-4xl font-bold leading-tight">“Harta tidak akan berkurang karena sedekah.”</p>
          <p className="mt-3 text-white/70">— HR. Muslim</p>
        </div>
        <p className="relative text-sm text-white/60">Riwayat donasi & kuitansi tersimpan rapi di satu tempat.</p>
      </div>
      <div className="flex flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="md:hidden"><Logo /></div>
          <h1 className="mt-8 text-2xl font-bold md:mt-0">Masuk ke akunmu</h1>
          <p className="mt-2 text-sm text-ink-faint">Lihat riwayat donasi, unduh kuitansi, dan kelola notifikasi. Donasi dengan email yang sama otomatis tersambung.</p>
          {state === 'error' && <Alert className="mt-5" tone="danger" title="Gagal masuk">Login dibatalkan atau email Google belum terverifikasi. Silakan coba lagi.</Alert>}
          <Button size="lg" variant="outline" block className="mt-6" disabled={state === 'loading'} onClick={() => go('donor-dashboard')}>
            {state === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h6a5.1 5.1 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-7.9z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
            )}
            Lanjutkan dengan Google
          </Button>
          <div className="mt-6 space-y-2 text-sm text-ink-soft">
            {['Tanpa password untuk diingat', 'Donasi tetap bisa tanpa akun', 'Kami tidak pernah memposting atas namamu'].map((t) => <p key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{t}</p>)}
          </div>
          <p className="mt-8 text-xs text-ink-faint">Dengan masuk, kamu menyetujui Syarat & Ketentuan serta Kebijakan Privasi Tebar Kebaikan.</p>
          <button onClick={() => go('home')} className="mt-4 text-sm font-semibold text-primary">← Kembali ke beranda</button>
        </div>
      </div>
    </div>
  );
}

/* ================= Dashboard ================= */
export function DonorDashboardPage() {
  const state = useMockState();
  const empty = state === 'empty';
  return (
    <DonorShell active="donor-dashboard" title="Assalamu’alaikum, Ahmad">
      {state === 'error' ? <Card><ErrorState /></Card> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {state === 'loading' ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : (
              <>
                <Stat label="Total donasi" value={empty ? 'Rp0' : rupiah(4_750_000)} hint="Sejak Maret 2025" icon={HandCoins} />
                <Stat label="Donasi berhasil" value={empty ? '0' : '14'} hint="9 program" icon={CheckCircle2} tone="gold" />
                <Stat label="Menunggu pembayaran" value={empty ? '0' : '1'} hint={empty ? '—' : 'Berakhir dalam 23 jam'} icon={Clock} tone="warning" />
              </>
            )}
          </div>

          {!empty && state === 'ready' && (
            <Alert className="mt-4" tone="warning" title="1 donasi menunggu pembayaran">Paket Sekolah untuk 500 Anak Yatim — {rupiah(350_000)}. <button className="font-semibold underline" onClick={() => go('instruction-va')}>Lanjutkan bayar</button></Alert>
          )}

          <Card className="mt-5">
            <CardHeader title="Donasi terbaru" action={<Button variant="ghost" size="sm" onClick={() => go('donor-transactions')}>Lihat semua<ArrowRight className="h-4 w-4" /></Button>} />
            <div className="p-2 sm:p-3">
              {state === 'loading' && <ListSkeleton rows={3} className="p-3" />}
              {empty && <EmptyState icon={HeartHandshake} title="Belum ada donasi" description="Mulai kebaikan pertamamu hari ini. Riwayat dan kuitansi akan tersimpan di sini." action={<Button onClick={() => go('home')}>Jelajahi program</Button>} />}
              {state === 'ready' && <TrxList items={mine.slice(0, 4)} />}
            </div>
          </Card>

          <section className="mt-8">
            <h2 className="font-bold">Mungkin kamu juga peduli</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.slice(2, 5).map((c) => <CampaignCard key={c.id} c={c} />)}</div>
          </section>
        </>
      )}
    </DonorShell>
  );
}

function TrxList({ items }: { items: typeof transactions }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((t) => (
        <li key={t.code + t.status}>
          <button onClick={() => go('donor-transaction-detail')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><ReceiptText className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{t.campaign}</span>
              <span className="block text-xs text-ink-faint">{t.createdAt} · {t.method}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="tabular text-sm font-bold">{rupiah(t.amount)}</span>
              <TrxStatusBadge status={t.status} />
            </span>
            <ChevronRight className="hidden h-4 w-4 text-ink-faint sm:block" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ================= Transaction list ================= */
export function DonorTransactionsPage() {
  const state = useMockState();
  const [status, setStatus] = useState<'all' | TrxStatus>('all');
  const items = state === 'empty' ? [] : mine.filter((t) => status === 'all' || t.status === status);
  return (
    <DonorShell active="donor-transactions" title="Riwayat Donasi">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter status">
          <option value="all">Semua status</option><option value="paid">Berhasil</option><option value="pending">Menunggu</option><option value="expired">Kedaluwarsa</option><option value="failed">Gagal</option>
        </Select>
        <Select aria-label="Filter tahun" defaultValue="2026"><option>2026</option><option>2025</option></Select>
      </div>
      <Card className="mt-4 p-2 sm:p-3">
        {state === 'loading' && <ListSkeleton rows={5} className="p-3" />}
        {state === 'error' && <ErrorState />}
        {(state === 'ready' || state === 'empty') && (items.length ? <TrxList items={items} /> : <EmptyState icon={ReceiptText} title="Tidak ada transaksi" description={state === 'empty' ? 'Donasi yang kamu lakukan akan muncul di sini.' : 'Tidak ada transaksi dengan filter ini.'} />)}
      </Card>
      {state === 'ready' && items.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-faint"><span>Menampilkan 1–{items.length} dari {items.length}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled>Sebelumnya</Button><Button variant="outline" size="sm" disabled>Berikutnya</Button></div></div>
      )}
    </DonorShell>
  );
}

/* ================= Transaction detail ================= */
export function DonorTransactionDetailPage() {
  const state = useMockState();
  const t = mine[0];
  const timeline = [
    { label: 'Donasi dibuat', at: '9 Nov 2026, 08.14 WIB', done: true },
    { label: 'Menunggu pembayaran · QRIS', at: '9 Nov 2026, 08.14 WIB', done: true },
    { label: 'Pembayaran diterima', at: '9 Nov 2026, 08.15 WIB', done: true },
    { label: 'Kuitansi KW/2026/004817 terbit', at: '9 Nov 2026, 08.15 WIB', done: true },
  ];
  return (
    <DonorShell active="donor-transactions" title="Detail Donasi" action={<Button variant="ghost" size="sm" onClick={() => go('donor-transactions')}>← Kembali</Button>}>
      {state === 'error' ? <Card><ErrorState title="Transaksi tidak ditemukan" description="Transaksi ini tidak ada atau bukan milik akunmu." /></Card> : state === 'loading' ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs text-ink-faint">Kode transaksi</p><p className="font-mono font-semibold">{t.code}</p></div>
              <TrxStatusBadge status={t.status} />
            </div>
            <p className="tabular mt-4 text-3xl font-bold text-primary-ink">{rupiah(t.amount)}</p>
            <p className="mt-1 text-sm text-ink-soft">{t.campaign}</p>
            <dl className="mt-5 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
              {[['Metode', t.method], ['Dibayar', '9 Nov 2026, 08.15 WIB'], ['Nama di publik', 'Ahmad Fauzi'], ['No. kuitansi', 'KW/2026/004817']].map(([k, v]) => (
                <div key={k}><dt className="text-ink-faint">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-5 rounded-xl bg-muted p-3 text-sm italic text-ink-soft">“Semoga airnya membawa berkah untuk warga.”</div>
            <h2 className="mt-6 font-semibold">Riwayat status</h2>
            <ol className="mt-3 space-y-4">
              {timeline.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', s.done ? 'bg-primary text-white' : 'bg-border')}><CheckCircle2 className="h-3.5 w-3.5" /></span>
                  <div><p className="text-sm font-medium">{s.label}</p><p className="flex items-center gap-1 text-xs text-ink-faint"><CalendarDays className="h-3 w-3" />{s.at}</p></div>
                </li>
              ))}
            </ol>
          </Card>
          <div className="space-y-3">
            <Card className="p-4">
              <p className="font-semibold">Dokumen</p>
              <Button variant="outline" block className="mt-3 justify-start"><FileText className="h-4 w-4" />Bukti Transaksi (PDF)</Button>
              <Button block className="mt-2 justify-start"><Download className="h-4 w-4" />Kuitansi Donasi (PDF)</Button>
              <p className="mt-3 flex gap-1.5 text-xs text-ink-faint"><ShieldCheck className="h-3.5 w-3.5 shrink-0" />Dokumen hanya bisa diunduh oleh pemilik akun.</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-semibold">Kabar terbaru program</p>
              <p className="mt-1 text-sm text-ink-soft">Pengeboran Tahap 1 Selesai, Air Muncul di Kedalaman 82 Meter</p>
              <Button variant="ghost" size="sm" className="mt-2 px-0 text-primary" onClick={() => go('news-detail')}>Baca kabar →</Button>
            </Card>
          </div>
        </div>
      )}
    </DonorShell>
  );
}

/* ================= Profile ================= */
export function DonorProfilePage() {
  const state = useMockState();
  const [wa, setWa] = useState(true);
  const [anon, setAnon] = useState(false);
  return (
    <DonorShell active="donor-profile" title="Profil">
      {state === 'loading' ? <Skeleton className="h-96 rounded-2xl" /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Data diri</h2>
            {state === 'error' && <Alert className="mt-3" tone="danger" title="Gagal menyimpan">Nomor WhatsApp tidak valid. Gunakan format 08xx atau +62.</Alert>}
            <div className="mt-4 space-y-4">
              <div><Label htmlFor="pn">Nama tampilan</Label><Input id="pn" defaultValue="Ahmad Fauzi" /></div>
              <div><Label htmlFor="pe">Email (dari Google)</Label><Input id="pe" defaultValue="ahmad.fauzi@example.com" readOnly className="bg-muted text-ink-faint" /></div>
              <div><Label htmlFor="pw">No. WhatsApp</Label><Input id="pw" defaultValue="0812 3450 0011" invalid={state === 'error'} /></div>
            </div>
            <Button className="mt-5">Simpan perubahan</Button>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Preferensi</h2>
            <div className="mt-4 space-y-5">
              <Switch checked label="Email status & kuitansi" description="Wajib untuk transaksi — tidak bisa dimatikan" />
              <Switch checked={wa} onChange={setWa} label="Notifikasi WhatsApp" description="Status pembayaran dan kabar penyaluran" />
              <Switch checked={anon} onChange={setAnon} label="Selalu sembunyikan nama saya" description="Default “Hamba Allah” setiap berdonasi" />
            </div>
            <div className="mt-8 border-t border-border pt-5">
              <p className="text-sm font-semibold text-danger">Hapus akun</p>
              <p className="mt-1 text-xs text-ink-faint">Data pribadimu akan dianonimkan. Catatan transaksi tetap disimpan untuk keperluan audit keuangan lembaga.</p>
              <Button variant="outline" size="sm" className="mt-3 text-danger">Ajukan penghapusan akun</Button>
            </div>
          </Card>
        </div>
      )}
    </DonorShell>
  );
}
