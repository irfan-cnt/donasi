import { useState } from 'react';
import { Mail, MessageCircle, RotateCw, Search, Send } from 'lucide-react';
import { notificationLogs, templateVariables, templates } from '@/data/sample';
import { cn } from '@/lib/utils';
import { useMockState } from '@/lib/mock-state';
import { AdminShell, Pagination, Table, Td } from '@/components/admin/AdminShell';
import { Alert, Badge, Button, Card, Input, Label, Segmented, Select, Skeleton, Switch, Textarea } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Logo } from '@/components/ui/shared';

const sample: Record<string, string> = { donor_name: 'Ahmad Fauzi', campaign_title: 'Sumur Bor untuk 300 Keluarga di Desa Oebelo, NTT', transaction_id: 'TK-261109-7QF3KD', donation_amount: 'Rp100.000', payment_method: 'BCA Virtual Account', payment_status: 'Berhasil', created_at: '9 Nov 2026, 08.14 WIB', payment_url: 'https://tebarkebaikan.org/transaksi/…', payment_instruction: 'VA 12345 0081 2345 678', donor_email: 'ahmad.fauzi@example.com', donor_phone: '+6281234500011' };
const render = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => sample[k] ?? `{{${k}}}`);

/* ================= Templates ================= */
export function AdminTemplatesPage() {
  const state = useMockState();
  const [channel, setChannel] = useState<'Email' | 'WhatsApp'>('Email');
  const [sel, setSel] = useState('t2');
  const t = templates.find((x) => x.id === sel)!;
  const [subject, setSubject] = useState(t.subject ?? '');
  const [body, setBody] = useState(
    'Assalamu’alaikum {{donor_name}},\n\nAlhamdulillah, donasimu sebesar {{donation_amount}} untuk program “{{campaign_title}}” telah kami terima melalui {{payment_method}}.\n\nKode transaksi: {{transaction_id}}\nWaktu: {{created_at}}\n\nKuitansi resmi terlampir. Semoga Allah membalas kebaikanmu dengan keberkahan.\n\nSalam hangat,\nTim Tebar Kebaikan',
  );
  const invalid = state === 'error';
  const list = templates.filter((x) => x.channel === channel);

  return (
    <AdminShell active="admin-templates" title="Template Notifikasi" description="Satu template aktif per event & kanal">
      <div className="grid gap-5 lg:grid-cols-[260px_1fr] 2xl:grid-cols-[280px_1fr_380px]">
        <Card className="p-3">
          <Segmented className="w-full" value={channel} onChange={(v) => { setChannel(v); setSel(v === 'Email' ? 't2' : 't8'); }} options={[{ value: 'Email', label: <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />Email</span> }, { value: 'WhatsApp', label: <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />WhatsApp</span> }]} />
          {state === 'loading' ? <div className="mt-3 space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div> : (
            <ul className="mt-3 space-y-1">
              {list.map((x) => (
                <li key={x.id}><button onClick={() => setSel(x.id)} className={cn('w-full rounded-xl px-3 py-2.5 text-left', sel === x.id ? 'bg-primary-soft' : 'hover:bg-muted')}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{x.name}</span>{x.active ? <Badge tone="success">Aktif</Badge> : <Badge>Nonaktif</Badge>}</div>
                  <p className="font-mono text-[11px] text-ink-faint">{x.event}</p>
                </button></li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" block className="mt-3">+ Template baru</Button>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold">{t.name}</h2><p className="font-mono text-xs text-ink-faint">{t.event} · {t.channel} · v3 · diubah {t.updated}</p></div>
            <div className="w-44"><Switch checked={t.active} label="Aktif" /></div>
          </div>
          {invalid && <Alert className="mt-4" tone="danger" title="Variabel tidak dikenal">{'{{donor_ktp}}'} tidak termasuk variabel yang diizinkan. Template tidak dapat disimpan.</Alert>}
          <div className="mt-4 space-y-4">
            {channel === 'Email' && <div><Label>Subjek</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>}
            <div><Label>Isi pesan</Label><Textarea rows={14} value={invalid ? body + '\nNo. KTP: {{donor_ktp}}' : body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs leading-relaxed" /></div>
            <div>
              <p className="text-xs font-medium text-ink-faint">Variabel tersedia — klik untuk menyisipkan</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{templateVariables.map((v) => <button key={v} onClick={() => setBody(body + ` {{${v}}}`)} className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-ink-soft hover:bg-primary-soft">{`{{${v}}}`}</button>)}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4"><Button variant="outline">Batal</Button><Button disabled={invalid}>Simpan versi baru</Button></div>
        </Card>

        <div className="grid min-w-0 gap-5 lg:col-span-2 lg:grid-cols-2 2xl:col-span-1 2xl:grid-cols-1 2xl:content-start">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-5 py-3"><p className="text-sm font-semibold">Pratinjau</p><p className="text-xs text-ink-faint">Dengan data contoh</p></div>
            {channel === 'Email' ? (
              <div className="bg-muted p-4">
                <div className="rounded-xl bg-white p-5 shadow-card">
                  <Logo className="scale-90" />
                  <p className="mt-4 text-sm font-semibold">{render(subject)}</p>
                  <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-ink-soft">{render(body)}</p>
                  <div className="mt-4 rounded-lg bg-primary px-3 py-2 text-center text-xs font-semibold text-white">Unduh Kuitansi</div>
                </div>
              </div>
            ) : (
              <div className="bg-[#E7DED3] p-4"><div className="ml-auto max-w-[90%] whitespace-pre-line rounded-xl rounded-tr-sm bg-[#DCF7C5] p-3 text-xs leading-relaxed shadow-sm">{render('Assalamu’alaikum {{donor_name}} 🤍\nDonasi {{donation_amount}} untuk *{{campaign_title}}* sudah kami terima.\nKode: {{transaction_id}}\nJazakallah khairan!')}</div></div>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold">Kirim tes</p>
            <p className="text-xs text-ink-faint">Hanya ke {channel === 'Email' ? 'email' : 'nomor'} admin yang sedang login</p>
            <Input className="mt-3" readOnly value={channel === 'Email' ? 'fajar@tebarkebaikan.org' : '+62811****2020'} />
            <Button variant="secondary" block className="mt-3"><Send className="h-4 w-4" />Kirim tes</Button>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

/* ================= Notification logs ================= */
export function AdminNotificationLogsPage() {
  const state = useMockState();
  return (
    <AdminShell active="admin-notification-logs" title="Log Notifikasi" description="Riwayat pengiriman email & WhatsApp. Kegagalan tidak memengaruhi status pembayaran.">
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><Input className="h-10 pl-9" placeholder="Kode transaksi atau penerima…" /></div>
          <Select><option>Semua kanal</option><option>Email</option><option>WhatsApp</option></Select>
          <Select><option>Semua status</option><option>sent</option><option>failed</option><option>skipped</option><option>queued</option></Select>
          <Select><option>Semua template</option>{templates.map((t) => <option key={t.id}>{t.name}</option>)}</Select>
        </div>
        {state === 'loading' && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>}
        {state === 'error' && <ErrorState />}
        {state === 'empty' && <EmptyState title="Belum ada notifikasi terkirim" />}
        {state === 'ready' && (
          <>
            <Table head={['Waktu', 'Kanal', 'Penerima', 'Template', 'Transaksi', 'Status', 'Respon provider', '']}>
              {notificationLogs.map((n) => (
                <tr key={n.id} className="hover:bg-muted/40">
                  <Td className="whitespace-nowrap text-ink-faint">{n.sentAt}</Td>
                  <Td>{n.channel === 'Email' ? <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-info" />Email</span> : <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-success" />WhatsApp</span>}</Td>
                  <Td className="font-mono text-xs">{n.recipient}</Td><Td>{n.template}</Td><Td className="font-mono text-xs">{n.trx}</Td>
                  <Td><Badge tone={n.status === 'sent' ? 'success' : n.status === 'failed' ? 'danger' : 'neutral'} dot>{n.status}</Badge></Td>
                  <Td className="max-w-[220px] truncate font-mono text-xs text-ink-faint">{n.response}</Td>
                  <Td>{n.status === 'failed' && <Button variant="ghost" size="sm"><RotateCw className="h-4 w-4" />Kirim ulang</Button>}</Td>
                </tr>
              ))}
            </Table>
            <Pagination total={9_731} shown={6} />
          </>
        )}
      </Card>
    </AdminShell>
  );
}
