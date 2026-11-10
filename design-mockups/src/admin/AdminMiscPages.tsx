import { Lock, ShieldCheck } from 'lucide-react';
import { go, useMockState } from '@/lib/mock-state';
import { AdminShell, Pagination, Table, Td } from '@/components/admin/AdminShell';
import { Alert, Badge, Button, Card, Input, Label, Select } from '@/components/ui/primitives';
import { EmptyState, Logo } from '@/components/ui/shared';

export function AdminLoginPage() {
  const state = useMockState();
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-ink px-4 py-10">
      <div className="pattern-islamic fixed inset-0" />
      <Card className="relative w-full max-w-sm p-6">
        <Logo />
        <Badge tone="gold" className="mt-3">Panel Admin</Badge>
        <h1 className="mt-4 text-xl font-bold">Masuk sebagai admin</h1>
        {state === 'error' && <Alert className="mt-4" tone="danger" title="Akun dikunci sementara">Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.</Alert>}
        <div className="mt-5 space-y-4">
          <div><Label htmlFor="ae">Email</Label><Input id="ae" type="email" defaultValue="fajar@tebarkebaikan.org" autoComplete="username" /></div>
          <div><Label htmlFor="ap">Password</Label><Input id="ap" type="password" defaultValue="••••••••••••" autoComplete="current-password" /></div>
          <div><Label htmlFor="ao">Kode autentikator (6 digit)</Label><Input id="ao" inputMode="numeric" maxLength={6} placeholder="123456" className="tabular tracking-[0.4em]" autoComplete="one-time-code" /></div>
        </div>
        <Button block size="lg" className="mt-6" disabled={state === 'loading'} onClick={() => go('admin-dashboard')}><Lock className="h-4 w-4" />{state === 'loading' ? 'Memverifikasi…' : 'Masuk'}</Button>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint"><ShieldCheck className="h-3.5 w-3.5" />Akun admin terpisah dari akun donatur. Lupa password? Hubungi owner.</p>
      </Card>
    </div>
  );
}

const audit = [
  ['9 Nov 2026 08:02', 'Fajar Ramadhan', 'campaign.update', 'Paket Sekolah untuk 500 Anak Yatim', 'max_amount: null → 3.500.000'],
  ['8 Nov 2026 17:45', 'Laila (finance)', 'transaction.export', '312 baris · 1–8 Nov', 'filter status=paid'],
  ['8 Nov 2026 16:10', 'Sistem', 'reconciliation.issue', 'TK-261108-P7DD0X', 'paid di provider, pending di DB → diproses'],
  ['8 Nov 2026 11:30', 'Rina (editor)', 'news.publish', 'Pengeboran Tahap 1 Selesai…', 'status: draft → published'],
  ['7 Nov 2026 09:12', 'Fajar Ramadhan', 'payment_method.update', 'Permata Virtual Account', 'is_active: true → false'],
];
export function AdminAuditPage() {
  const state = useMockState();
  return (
    <AdminShell active="admin-audit" title="Audit Log" description="Catatan perubahan oleh admin & sistem (read-only)">
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-border p-4"><Input className="h-10 max-w-xs" placeholder="Cari entitas…" /><Select><option>Semua aktor</option></Select><Select><option>Semua aksi</option></Select></div>
        {state === 'empty' ? <EmptyState title="Belum ada aktivitas" /> : (
          <>
            <Table head={['Waktu', 'Aktor', 'Aksi', 'Entitas', 'Perubahan']}>
              {audit.map((r) => <tr key={r[0] + r[2]}><Td className="whitespace-nowrap text-ink-faint">{r[0]}</Td><Td>{r[1]}</Td><Td className="font-mono text-xs">{r[2]}</Td><Td className="max-w-[240px] truncate">{r[3]}</Td><Td className="font-mono text-xs text-ink-soft">{r[4]}</Td></tr>)}
            </Table>
            <Pagination total={1_284} shown={5} />
          </>
        )}
      </Card>
    </AdminShell>
  );
}
