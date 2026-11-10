import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Eye, Filter, GripVertical, KeyRound, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { donors, paymentEvents, paymentMethods, transactions } from '@/data/sample';
import { cn, rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { AdminShell, Pagination, Table, Td } from '@/components/admin/AdminShell';
import { Alert, Avatar, Badge, Button, Card, CardHeader, Input, Label, Select, Skeleton, Switch, Textarea } from '@/components/ui/primitives';
import { EmptyState, ErrorState, MethodMark, Stat, TrxStatusBadge } from '@/components/ui/shared';

function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 border-b border-border p-4">{children}</div>;
}
function SearchInput({ placeholder }: { placeholder: string }) {
  return <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><Input className="h-10 pl-9" placeholder={placeholder} /></div>;
}
function ListBody({ state, children, empty }: { state: string; children: React.ReactNode; empty: string }) {
  if (state === 'loading') return <div className="space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>;
  if (state === 'error') return <ErrorState />;
  if (state === 'empty') return <EmptyState title={empty} description="Coba ubah filter atau rentang tanggal." />;
  return <>{children}</>;
}

/* ================= Transactions ================= */
export function AdminTransactionsPage() {
  const state = useMockState();
  return (
    <AdminShell active="admin-transactions" title="Transaksi" description="Status hanya berubah dari webhook terverifikasi atau cek status ke provider"
      actions={<Button variant="outline"><Download className="h-4 w-4" />Ekspor CSV</Button>}>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Berhasil (hari ini)" value={rupiah(18_450_000)} hint="214 transaksi" />
        <Stat label="Menunggu" value="127" hint={rupiah(41_200_000)} tone="warning" />
        <Stat label="Kedaluwarsa (7 hari)" value="389" tone="info" />
        <Stat label="Perlu ditinjau" value="2" hint="amount mismatch" tone="gold" />
      </div>
      <Card>
        <FilterBar>
          <SearchInput placeholder="Kode transaksi, nama, email, atau no. WA…" />
          <Select><option>Semua status</option><option>Berhasil</option><option>Menunggu</option><option>Kedaluwarsa</option><option>Gagal</option><option>Dibatalkan</option></Select>
          <Select><option>Semua campaign</option></Select>
          <Select><option>Semua provider</option><option>Midtrans</option></Select>
          <Input type="date" className="h-10 !w-40" defaultValue="2026-11-01" aria-label="Dari tanggal" />
          <Input type="date" className="h-10 !w-40" defaultValue="2026-11-09" aria-label="Sampai tanggal" />
          <Button variant="ghost" size="sm"><Filter className="h-4 w-4" />Reset</Button>
        </FilterBar>
        <ListBody state={state} empty="Tidak ada transaksi">
          <Table head={['Kode', 'Donatur', 'Campaign', 'Nominal', 'Metode', 'Provider', 'Status', 'Dibuat', '']}>
            {transactions.map((t) => (
              <tr key={t.code} className="hover:bg-muted/40">
                <Td className="whitespace-nowrap font-mono text-xs">{t.code}</Td>
                <Td><p className="font-medium">{t.anonymous ? `${t.donor} *` : t.donor}</p><p className="text-xs text-ink-faint">{t.email}</p></Td>
                <Td className="max-w-[200px] truncate">{t.campaign}</Td>
                <Td className="tabular font-semibold">{rupiah(t.amount)}</Td>
                <Td className="whitespace-nowrap">{t.method}</Td>
                <Td><Badge tone={t.provider === 'Midtrans' ? 'info' : 'primary'}>{t.provider}</Badge></Td>
                <Td><TrxStatusBadge status={t.status} /></Td>
                <Td className="whitespace-nowrap text-ink-faint">{t.createdAt}</Td>
                <Td><Button variant="ghost" size="sm" onClick={() => go('admin-transaction-detail')}><Eye className="h-4 w-4" /></Button></Td>
              </tr>
            ))}
          </Table>
          <Pagination total={4_218} shown={8} />
        </ListBody>
      </Card>
      <p className="mt-3 text-xs text-ink-faint">* Donatur memilih tampil sebagai Hamba Allah. Nama asli hanya terlihat oleh admin.</p>
    </AdminShell>
  );
}

/* ================= Transaction detail ================= */
export function AdminTransactionDetailPage() {
  const state = useMockState();
  const t = transactions[0];
  return (
    <AdminShell active="admin-transactions" title={t.code} description="Detail transaksi" actions={<><Button variant="outline" size="sm" onClick={() => go('admin-transactions')}>← Kembali</Button><Button variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Cek status ke provider</Button></>}>
      {state === 'loading' ? <Skeleton className="h-96 rounded-2xl" /> : state === 'error' ? <Card><ErrorState title="Transaksi tidak ditemukan" /></Card> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-3"><TrxStatusBadge status={t.status} /><span className="text-sm text-ink-faint">Dibayar {t.paidAt} WIB · Kuitansi KW/2026/004817</span></div>
              <p className="tabular mt-3 text-3xl font-bold">{rupiah(t.amount)}</p>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[['Campaign', t.campaign], ['Metode', `${t.method} (${t.provider})`], ['Biaya gateway', 'Rp1.750 (ditanggung lembaga)'], ['Sumber', 'instagram / bio-link'], ['Anonim', 'Tidak'], ['Doa', '“Semoga airnya membawa berkah…”']].map(([k, v]) => <div key={k}><dt className="text-ink-faint">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              </dl>
            </Card>
            <Card>
              <CardHeader title="Percobaan pembayaran" description="Satu transaksi dapat memiliki beberapa percobaan; maksimal satu aktif" />
              <Table className="mt-4" head={['Payment ID', 'Metode', 'Ref provider', 'Status', 'Kedaluwarsa', 'Dibuat']}>
                <tr><Td className="font-mono text-xs">0193b2…a71c</Td><Td>GoPay</Td><Td className="font-mono text-xs">—</Td><Td><TrxStatusBadge status="cancelled" /></Td><Td>—</Td><Td>08:14:02</Td></tr>
                <tr><Td className="font-mono text-xs">0193b2…c09e</Td><Td>QRIS</Td><Td className="font-mono text-xs">a8f3e1c2-77d0</Td><Td><TrxStatusBadge status="paid" /></Td><Td>08:29:20</Td><Td>08:14:20</Td></tr>
              </Table>
            </Card>
            <Card>
              <CardHeader title="Event pembayaran" description="Webhook & pengecekan status (payload ter-redaksi)" action={<Button variant="ghost" size="sm" onClick={() => go('admin-payment-logs')}>Semua log</Button>} />
              <ol className="space-y-3 p-5">
                {paymentEvents.filter((e) => e.ref === t.code).concat([{ id: 'x', provider: 'Midtrans', type: 'create_request', ref: t.code, reported: 'pending', verification: 'verified', result: 'processed', at: '9 Nov 2026 08:14:20' }]).map((e) => (
                  <li key={e.id} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
                    {e.result === 'processed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />}
                    <div className="min-w-0 flex-1"><p className="font-medium">{e.type} · <span className="font-mono">{e.reported}</span></p><p className="text-xs text-ink-faint">{e.at} · verifikasi {e.verification} · hasil {e.result}</p></div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <h2 className="font-semibold">Donatur</h2>
              <div className="mt-3 flex items-center gap-3"><Avatar name={t.donor} /><div><p className="font-medium">{t.donor}</p><p className="text-xs text-ink-faint">{t.email}</p></div></div>
              <p className="mt-3 text-sm text-ink-soft">{t.phone} · WA opt-in ✓</p>
              <Badge tone="primary" className="mt-2">Akun Google</Badge>
              <Button variant="outline" size="sm" block className="mt-4" onClick={() => go('admin-donors')}>Lihat profil donatur</Button>
            </Card>
            <Card>
              <CardHeader title="Notifikasi terkirim" />
              <ul className="space-y-2 p-5 text-sm">
                {[['Email · Menunggu Pembayaran', 'sent'], ['Email · Donasi Berhasil', 'sent'], ['Email · Kuitansi', 'sent'], ['WA · Donasi Berhasil', 'sent']].map(([n, s]) => <li key={n} className="flex justify-between"><span>{n}</span><Badge tone="success">{s}</Badge></li>)}
              </ul>
            </Card>
            <Alert tone="info" title="Tidak ada aksi ‘tandai lunas’">Status hanya dapat berubah melalui verifikasi provider (BR-18, BR-41).</Alert>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/* ================= Donors ================= */
export function AdminDonorsPage() {
  const state = useMockState();
  const [sel, setSel] = useState(0);
  const d = donors[sel];
  return (
    <AdminShell active="admin-donors" title="Donatur" description="Donatur akun Google dan tamu (dikelompokkan per email)" actions={<Button variant="outline"><Download className="h-4 w-4" />Ekspor</Button>}>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <FilterBar>
            <SearchInput placeholder="Nama, email, atau no. WA…" />
            <Select><option>Semua tipe</option><option>Akun Google</option><option>Tamu</option></Select>
            <Select><option>Urut: total donasi</option><option>Donasi terakhir</option><option>Jumlah transaksi</option></Select>
          </FilterBar>
          <ListBody state={state} empty="Belum ada donatur">
            <Table head={['Donatur', 'WhatsApp', 'Total donasi', 'Transaksi', 'Terakhir', 'Tipe']}>
              {donors.map((x, i) => (
                <tr key={x.email} onClick={() => setSel(i)} className={cn('cursor-pointer hover:bg-muted/40', sel === i && 'bg-primary-soft/40')}>
                  <Td><div className="flex items-center gap-3"><Avatar name={x.name} /><div><p className="font-medium">{x.name}</p><p className="text-xs text-ink-faint">{x.email}</p></div></div></Td>
                  <Td className="text-ink-faint">{x.phone}</Td><Td className="tabular font-semibold">{rupiah(x.total)}</Td><Td className="tabular">{x.count}</Td><Td className="whitespace-nowrap text-ink-faint">{x.last}</Td>
                  <Td>{x.account ? <Badge tone="primary">Akun</Badge> : <Badge>Tamu</Badge>}</Td>
                </tr>
              ))}
            </Table>
            <Pagination total={2_106} shown={6} />
          </ListBody>
        </Card>
        {state === 'ready' && (
          <Card className="p-5">
            <div className="flex items-center gap-3"><Avatar name={d.name} className="h-12 w-12" /><div><p className="font-semibold">{d.name}</p><p className="text-sm text-ink-faint">{d.email}</p></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted p-3"><p className="text-xs text-ink-faint">Total</p><p className="tabular font-bold">{rupiah(d.total)}</p></div><div className="rounded-xl bg-muted p-3"><p className="text-xs text-ink-faint">Transaksi</p><p className="font-bold">{d.count}</p></div></div>
            <h3 className="mt-5 text-sm font-semibold">Riwayat transaksi</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {transactions.filter((t) => t.donor === d.name || t.email === d.email).slice(0, 5).map((t) => (
                <li key={t.code} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate">{t.campaign}</p><p className="text-xs text-ink-faint">{t.createdAt}</p></div><div className="text-right"><p className="tabular font-semibold">{rupiah(t.amount)}</p><TrxStatusBadge status={t.status} /></div></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}

/* ================= Payment methods ================= */
export function AdminPaymentMethodsPage() {
  const state = useMockState();
  const [selected, setSelected] = useState('bca_va');
  const m = paymentMethods.find((x) => x.code === selected)!;
  return (
    <AdminShell active="admin-payment-methods" title="Metode Pembayaran" description="Atur metode aktif, urutan, dan instruksi. Kredensial provider dikelola di environment server.">
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {[{ n: 'Midtrans', ok: state !== 'error', mode: 'Sandbox', hook: state === 'error' ? 'gagal (401)' : '2 menit lalu' }].map((p) => (
          <Card key={p.n} className="flex items-center gap-4 p-4">
            <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', p.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>{p.ok ? <ShieldCheck className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}</span>
            <div className="flex-1"><p className="font-semibold">{p.n}</p><p className="text-xs text-ink-faint">{p.ok ? 'Terkonfigurasi' : 'Kredensial tidak valid'} · {p.mode} · webhook terakhir {p.hook}</p></div>
            <div className="flex flex-col items-end gap-1"><Badge tone="warning">{p.mode}</Badge><button className="flex items-center gap-1 text-xs font-medium text-primary"><KeyRound className="h-3 w-3" />Tes koneksi</button></div>
          </Card>
        ))}
      </div>
      {state === 'error' && <Alert className="mb-5" tone="danger" title="Midtrans tidak dapat dihubungi">Semua metode pembayaran otomatis disembunyikan dari donatur. Periksa MIDTRANS_SERVER_KEY di environment Vercel.</Alert>}
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title="Daftar metode" description="Seret untuk mengubah urutan tampil" />
          {state === 'loading' ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> : (
            <ul className="mt-3 divide-y divide-border">
              {paymentMethods.map((x) => (
                <li key={x.code} className={cn('flex cursor-pointer items-center gap-3 px-5 py-3', selected === x.code && 'bg-primary-soft/40')} onClick={() => setSelected(x.code)}>
                  <GripVertical className="h-4 w-4 text-ink-faint" />
                  <MethodMark name={x.name} color={x.color} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{x.name}</p><p className="text-xs text-ink-faint">{x.group} · {x.provider} · {x.expiry}</p></div>
                  {state === 'error' && x.provider === 'Midtrans' ? <Badge tone="danger">Provider error</Badge> : <Badge tone={x.active ? 'success' : 'neutral'} dot>{x.active ? 'Aktif' : 'Nonaktif'}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3"><MethodMark name={m.name} color={m.color} /><div><h2 className="font-semibold">{m.name}</h2><p className="text-xs text-ink-faint">Kode: {m.code} · channel provider: {m.code.toUpperCase()}</p></div></div>
          <div className="mt-5 space-y-4">
            <Switch checked={m.active} label="Tampilkan ke donatur" />
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nama tampil</Label><Input defaultValue={m.name} /></div>
              <div><Label>Provider</Label><Select className="h-11 w-full" defaultValue={m.provider}><option>Midtrans</option></Select></div>
              <div><Label>Min. nominal</Label><Input defaultValue="Rp10.000" /></div>
              <div><Label>Masa berlaku</Label><Select className="h-11 w-full" defaultValue={m.expiry}><option>15 menit</option><option>1 jam</option><option>24 jam</option></Select></div>
            </div>
            <div><Label>Biaya ditanggung</Label><Select className="h-11 w-full"><option>Lembaga (donatur bayar nominal tepat)</option><option>Donatur</option></Select></div>
            <div>
              <Label>Instruksi — m-Banking</Label>
              <Textarea rows={4} defaultValue={'1. Buka aplikasi m-banking, pilih Transfer → Virtual Account.\n2. Masukkan nomor {{va_number}}.\n3. Pastikan nominal {{amount}} dan nama penerima sesuai.\n4. Masukkan PIN.'} className="font-mono text-xs" />
              <button className="mt-2 text-xs font-semibold text-primary">+ Tambah kanal (ATM, internet banking)</button>
            </div>
          </div>
          <div className="mt-5 flex gap-2 border-t border-border pt-4"><Button variant="outline" className="flex-1">Batal</Button><Button className="flex-1">Simpan</Button></div>
        </Card>
      </div>
    </AdminShell>
  );
}

/* ================= Payment logs ================= */
export function AdminPaymentLogsPage() {
  const state = useMockState();
  const [open, setOpen] = useState('e4');
  return (
    <AdminShell active="admin-payment-logs" title="Log Pembayaran" description="Webhook, request, dan pengecekan status dari Midtrans (append-only)">
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <FilterBar>
            <SearchInput placeholder="Kode transaksi atau ref provider…" />
            <Select><option>Semua provider</option><option>Midtrans</option></Select>
            <Select><option>Semua tipe</option><option>webhook</option><option>create_request</option><option>status_check</option></Select>
            <Select><option>Semua hasil</option><option>processed</option><option>duplicate</option><option>rejected</option><option>amount_mismatch</option></Select>
          </FilterBar>
          <ListBody state={state} empty="Belum ada event">
            <Table head={['Waktu', 'Provider', 'Tipe', 'Transaksi', 'Dilaporkan', 'Verifikasi', 'Hasil']}>
              {paymentEvents.map((e) => (
                <tr key={e.id} onClick={() => setOpen(e.id)} className={cn('cursor-pointer hover:bg-muted/40', open === e.id && 'bg-primary-soft/40')}>
                  <Td className="whitespace-nowrap text-ink-faint">{e.at}</Td><Td>{e.provider}</Td><Td className="font-mono text-xs">{e.type}</Td><Td className="font-mono text-xs">{e.ref}</Td><Td className="font-mono text-xs">{e.reported}</Td>
                  <Td><Badge tone={e.verification === 'verified' ? 'success' : 'danger'}>{e.verification}</Badge></Td>
                  <Td><Badge tone={e.result === 'processed' ? 'success' : e.result === 'duplicate' ? 'info' : 'danger'}>{e.result}</Badge></Td>
                </tr>
              ))}
            </Table>
            <Pagination total={18_942} shown={6} />
          </ListBody>
        </Card>
        {state === 'ready' && (
          <Card className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Detail event</h2><Badge tone="danger">rejected</Badge></div>
            <Alert className="mt-3" tone="danger" title="Token callback tidak cocok">Header x-callback-token tidak sesuai. Status tidak diubah. IP sumber: 203.0.113.48.</Alert>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-white/85">{`{
  "id": "pr_9f2c…",
  "reference_id": "0193b2f1-…",
  "status": "SUCCEEDED",
  "amount": 5000000,
  "currency": "IDR",
  "channel_code": "BRI",
  "x-callback-token": "***redacted***"
}`}</pre>
            <Button variant="outline" size="sm" className="mt-4"><ExternalLink className="h-4 w-4" />Buka transaksi terkait</Button>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
