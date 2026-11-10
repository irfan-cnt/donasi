import { ArrowUpRight, CalendarRange, CheckCircle2, Clock, HandCoins, Megaphone, Users } from 'lucide-react';
import { campaigns, dailyDonations, transactions } from '@/data/sample';
import { percent, rupiah, rupiahCompact } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { AdminShell, BarChart, Table, Td } from '@/components/admin/AdminShell';
import { Button, Card, CardHeader, Progress, Select, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Stat, TrxStatusBadge } from '@/components/ui/shared';

export default function AdminDashboardPage() {
  const state = useMockState();
  const total = dailyDonations.reduce((a, b) => a + b, 0);
  return (
    <AdminShell active="admin-dashboard" title="Dashboard" description="Ringkasan 30 hari terakhir · data per 9 Nov 2026, 08.20 WIB"
      actions={<><Select defaultValue="30"><option value="7">7 hari</option><option value="30">30 hari</option><option value="90">90 hari</option></Select><Button variant="outline" size="sm"><CalendarRange className="h-4 w-4" />Rentang khusus</Button></>}>
      {state === 'error' ? <Card><ErrorState title="Gagal memuat dashboard" /></Card> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {state === 'loading' ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : (
              <>
                <Stat label="Total donasi" value={state === 'empty' ? 'Rp0' : rupiahCompact(total)} hint={<span className="text-success">▲ 18,4% vs periode lalu</span>} icon={HandCoins} />
                <Stat label="Transaksi sukses" value={state === 'empty' ? '0' : '3.482'} hint="Konversi bayar 61%" icon={CheckCircle2} tone="gold" />
                <Stat label="Menunggu bayar" value={state === 'empty' ? '0' : '127'} hint="Rp41,2 jt potensial" icon={Clock} tone="warning" />
                <Stat label="Total donatur" value={state === 'empty' ? '0' : '2.106'} hint="412 donatur baru" icon={Users} tone="info" />
                <Stat label="Campaign aktif" value={state === 'empty' ? '0' : '5'} hint="1 dijeda" icon={Megaphone} />
              </>
            )}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader title="Donasi harian" description="Nominal transaksi berhasil (Rp)" action={<span className="tabular text-sm font-semibold">{rupiah(total)}</span>} />
              <div className="p-5">{state === 'loading' ? <Skeleton className="h-44" /> : state === 'empty' ? <EmptyState title="Belum ada donasi pada periode ini" /> : <BarChart data={dailyDonations} labels={['10 Okt', '17 Okt', '24 Okt', '31 Okt', '9 Nov']} />}</div>
            </Card>
            <Card>
              <CardHeader title="Performa campaign" description="Terkumpul vs target" action={<Button variant="ghost" size="sm" onClick={() => go('admin-campaigns')}>Semua</Button>} />
              <ul className="space-y-4 p-5">
                {(state === 'empty' ? [] : campaigns.filter((c) => c.status === 'published')).slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <div className="flex justify-between gap-3 text-sm"><span className="truncate font-medium">{c.title}</span><span className="tabular shrink-0 text-ink-faint">{c.target ? `${percent(c.collected, c.target)}%` : '—'}</span></div>
                    <Progress value={c.target ? percent(c.collected, c.target) : 100} tone={c.target ? 'primary' : 'gold'} className="mt-1.5 h-1.5" />
                    <p className="tabular mt-1 text-xs text-ink-faint">{rupiah(c.collected)}{c.target ? ` / ${rupiah(c.target)}` : ' · tanpa target'}</p>
                  </li>
                ))}
                {state === 'empty' && <EmptyState title="Belum ada campaign aktif" />}
              </ul>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader title="Transaksi terbaru" action={<Button variant="ghost" size="sm" onClick={() => go('admin-transactions')}>Lihat semua<ArrowUpRight className="h-4 w-4" /></Button>} />
            <div className="mt-4">
              {state === 'empty' ? <EmptyState title="Belum ada transaksi" /> : (
                <Table head={['Kode', 'Donatur', 'Campaign', 'Nominal', 'Metode', 'Status', 'Waktu']}>
                  {transactions.slice(0, 6).map((t) => (
                    <tr key={t.code} className="cursor-pointer hover:bg-muted/50" onClick={() => go('admin-transaction-detail')}>
                      <Td className="whitespace-nowrap font-mono text-xs">{t.code}</Td><Td>{t.donor}</Td><Td className="max-w-[220px] truncate">{t.campaign}</Td>
                      <Td className="tabular font-semibold">{rupiah(t.amount)}</Td><Td>{t.method}</Td><Td><TrxStatusBadge status={t.status} /></Td><Td className="whitespace-nowrap text-ink-faint">{t.createdAt}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
