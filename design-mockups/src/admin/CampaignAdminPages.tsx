import { useState } from 'react';
import { Archive, Bold, Eye, GripVertical, ImagePlus, Italic, Link2, List, MoreHorizontal, Pause, Plus, Search, Trash2, Upload } from 'lucide-react';
import { campaigns, categories, news, type CampaignStatus } from '@/data/sample';
import { cn, percent, rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { AdminShell, Pagination, Table, Td } from '@/components/admin/AdminShell';
import { categoryOf } from '@/components/public/campaign';
import { Alert, Badge, Button, Card, CardHeader, FieldError, Input, Label, Progress, Segmented, Select, Skeleton, Switch, Textarea } from '@/components/ui/primitives';
import { EmptyState, ErrorState, ImagePh } from '@/components/ui/shared';

const statusTone: Record<CampaignStatus, 'success' | 'warning' | 'neutral' | 'info' | 'danger'> = { published: 'success', paused: 'warning', draft: 'neutral', completed: 'info', archived: 'neutral' };
const statusLabel: Record<CampaignStatus, string> = { published: 'Tayang', paused: 'Dijeda', draft: 'Draf', completed: 'Selesai', archived: 'Diarsipkan' };
export const CampaignStatusBadge = ({ s }: { s: CampaignStatus }) => <Badge tone={statusTone[s]} dot>{statusLabel[s]}</Badge>;

/* ================= Campaign list ================= */
export function AdminCampaignsPage() {
  const state = useMockState();
  const rows = state === 'empty' ? [] : [...campaigns, { ...campaigns[3], id: 'c7', title: 'Wakaf Al-Qur’an untuk Pesantren Pesisir', status: 'draft' as const, collected: 0, donors: 0, hue: 90 }];
  return (
    <AdminShell active="admin-campaigns" title="Campaign" description="Kelola program donasi, nominal, dan status tayang" actions={<Button onClick={() => go('admin-campaign-editor')}><Plus className="h-4 w-4" />Campaign Baru</Button>}>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><Input className="h-10 pl-9" placeholder="Cari judul campaign…" /></div>
          <Select><option>Semua status</option>{Object.values(statusLabel).map((s) => <option key={s}>{s}</option>)}</Select>
          <Select><option>Semua kategori</option>{categories.map((c) => <option key={c.slug}>{c.name}</option>)}</Select>
          <Select><option>Tipe nominal: semua</option><option>Open amount</option><option>Fixed amount</option></Select>
        </div>
        {state === 'loading' && <div className="space-y-3 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
        {state === 'error' && <ErrorState />}
        {state === 'empty' && <EmptyState title="Belum ada campaign" description="Buat campaign pertama untuk mulai menerima donasi." action={<Button onClick={() => go('admin-campaign-editor')}><Plus className="h-4 w-4" />Campaign Baru</Button>} />}
        {state === 'ready' && (
          <>
            <Table head={['Campaign', 'Status', 'Nominal', 'Terkumpul', 'Donasi', 'Berakhir', '']}>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td>
                    <div className="flex items-center gap-3">
                      <ImagePh hue={c.hue} className="h-10 w-14 shrink-0" rounded="rounded-lg" label={c.title} />
                      <div className="min-w-0"><button onClick={() => go('admin-campaign-editor')} className="block max-w-[280px] truncate text-left font-semibold hover:text-primary">{c.title}</button><p className="text-xs text-ink-faint">{categoryOf(c.category).name} · /{c.slug}</p></div>
                    </div>
                  </Td>
                  <Td><CampaignStatusBadge s={c.status} /></Td>
                  <Td><Badge tone={c.amountType === 'open' ? 'primary' : 'gold'}>{c.amountType === 'open' ? 'Open' : 'Fixed'}</Badge></Td>
                  <Td className="min-w-[180px]"><p className="tabular font-semibold">{rupiah(c.collected)}</p>{c.target ? <Progress value={percent(c.collected, c.target)} className="mt-1 h-1" /> : <p className="text-xs text-ink-faint">tanpa target</p>}</Td>
                  <Td className="tabular">{c.donors.toLocaleString('id-ID')}</Td>
                  <Td className="whitespace-nowrap text-ink-faint">{c.daysLeft === null ? '—' : c.daysLeft === 0 ? 'Berakhir' : `${c.daysLeft} hari lagi`}</Td>
                  <Td><button className="rounded-lg p-1.5 hover:bg-muted" aria-label="Aksi lain"><MoreHorizontal className="h-4 w-4" /></button></Td>
                </tr>
              ))}
            </Table>
            <Pagination total={rows.length} shown={rows.length} />
          </>
        )}
      </Card>
    </AdminShell>
  );
}

/* ================= Campaign editor ================= */
export function AdminCampaignEditorPage() {
  const state = useMockState();
  const [type, setType] = useState<'open' | 'fixed'>('fixed');
  const [hasTarget, setHasTarget] = useState(true);
  const c = campaigns[1];
  return (
    <AdminShell active="admin-campaigns" title="Edit Campaign" description={`/campaign/${c.slug}`}
      actions={<><Button variant="outline" size="sm"><Eye className="h-4 w-4" />Pratinjau</Button><Button variant="outline" size="sm"><Pause className="h-4 w-4" />Jeda</Button><Button size="sm" disabled={state === 'loading'}>{state === 'loading' ? 'Menyimpan…' : 'Simpan & Terbitkan'}</Button></>}>
      {state === 'error' && <Alert className="mb-5" tone="danger" title="3 kolom perlu diperbaiki">Gambar galeri #2 belum memiliki teks alternatif · Paket “Paket Satu Kelas” melebihi maksimum platform · SEO description lebih dari 160 karakter.</Alert>}
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold">Informasi utama</h2>
            <div className="mt-4 grid gap-4">
              <div><Label htmlFor="t">Judul</Label><Input id="t" defaultValue={c.title} /><p className="mt-1 text-xs text-ink-faint">57/120 karakter</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="s">Slug</Label><Input id="s" defaultValue={c.slug} className="font-mono text-xs" /></div>
                <div><Label htmlFor="k">Kategori</Label><Select id="k" className="h-11 w-full" defaultValue="Pendidikan">{categories.map((x) => <option key={x.slug}>{x.name}</option>)}</Select></div>
              </div>
              <div><Label htmlFor="sd">Deskripsi singkat</Label><Textarea id="sd" rows={2} defaultValue={c.short} /></div>
              <div>
                <Label>Deskripsi lengkap</Label>
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="flex gap-1 border-b border-border bg-muted/60 p-1.5">{[Bold, Italic, List, Link2, ImagePlus].map((I, i) => <button key={i} className="rounded-md p-1.5 hover:bg-surface"><I className="h-4 w-4" /></button>)}</div>
                  <div className="prose-tk min-h-[140px] p-4 text-sm"><p>Setiap tahun ajaran baru, banyak anak yatim di binaan kami berangkat sekolah dengan seragam lusuh dan tanpa tas. <strong>Kamu bisa mengubahnya.</strong></p><p>Pilih paket sesuai kemampuanmu — setiap paket akan diterimakan langsung kepada anak beserta dokumentasinya.</p></div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold">Nominal donasi</h2><p className="text-xs text-ink-faint">Terpisah dari target penggalangan</p></div>
              <Segmented value={type} onChange={setType} options={[{ value: 'open', label: 'Open amount' }, { value: 'fixed', label: 'Fixed amount' }]} />
            </div>
            {type === 'open' ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Minimum donasi</Label><Input defaultValue="Rp10.000" className="tabular" /></div>
                  <div><Label optional>Maksimum donasi</Label><Input defaultValue="Rp100.000.000" className="tabular" /></div>
                </div>
                <div>
                  <Label>Saran nominal (maks. 6)</Label>
                  <div className="flex flex-wrap gap-2">
                    {[25_000, 50_000, 100_000, 250_000].map((v) => <span key={v} className="tabular inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm">{rupiah(v)}<button aria-label="Hapus" className="text-ink-faint hover:text-danger">×</button></span>)}
                    <button className="rounded-full border border-dashed border-primary px-3 py-1.5 text-sm font-medium text-primary">+ Tambah</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {c.packages.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 p-3">
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-ink-faint" aria-label="Urutkan" />
                      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_140px]">
                        <Input className="h-9" defaultValue={p.label} aria-label="Label paket" />
                        <Input className={cn('tabular h-9', state === 'error' && i === 3 && 'border-danger')} defaultValue={rupiah(p.amount)} aria-label="Nominal paket" />
                        <Input className="h-9 sm:col-span-2" defaultValue={p.description} aria-label="Deskripsi paket" />
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-1"><span className="text-[10px] text-ink-faint">Aktif</span><Switch checked={p.active} label="" /></div>
                    </li>
                  ))}
                </ul>
                {state === 'error' && <FieldError>Nominal melebihi batas platform Rp1.000.000.000</FieldError>}
                <Button variant="outline" size="sm" className="mt-3"><Plus className="h-4 w-4" />Tambah paket</Button>
                <p className="mt-2 text-xs text-ink-faint">Paket yang pernah dipakai transaksi tidak bisa dihapus — nonaktifkan saja.</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Gambar</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
              <div><ImagePh hue={c.hue} className="aspect-[16/10] w-full" label="Gambar utama" /><Button variant="outline" size="sm" block className="mt-2"><Upload className="h-4 w-4" />Ganti gambar utama</Button></div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    <ImagePh hue={c.hue + i * 20} className="aspect-square w-full" label={`Galeri ${i + 1}`} />
                    <Input className={cn('mt-1 h-8 text-xs', state === 'error' && i === 1 && 'border-danger')} placeholder="Teks alternatif (wajib)" defaultValue={i === 1 ? '' : 'Anak-anak menerima paket sekolah'} />
                  </div>
                ))}
                <button className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-xs text-ink-faint hover:border-primary"><ImagePlus className="h-5 w-5" />Tambah</button>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-faint">JPG/PNG/WebP maks. 2 MB, otomatis dikompresi ke WebP.</p>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">SEO</h2>
            <div className="mt-4 space-y-4">
              <div><Label optional>SEO title</Label><Input defaultValue="Donasi Paket Sekolah Anak Yatim | Tebar Kebaikan" /></div>
              <div><Label optional>SEO description</Label><Textarea rows={2} defaultValue="Bantu 500 anak yatim berangkat sekolah dengan seragam, tas, dan alat tulis baru. Pilih paket donasi mulai Rp75.000." /><p className="mt-1 text-xs text-ink-faint">118/160 karakter</p></div>
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm"><p className="text-info">Donasi Paket Sekolah Anak Yatim | Tebar Kebaikan</p><p className="text-xs text-success">tebarkebaikan.org › campaign › {c.slug}</p><p className="mt-0.5 text-xs text-ink-faint">Bantu 500 anak yatim berangkat sekolah dengan seragam, tas, dan alat tulis baru…</p></div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold">Status & jadwal</h2>
            <div className="mt-3 flex items-center justify-between"><span className="text-sm text-ink-faint">Status saat ini</span><CampaignStatusBadge s="published" /></div>
            <div className="mt-4 space-y-3">
              <div><Label>Mulai</Label><Input type="date" defaultValue="2026-10-01" /></div>
              <div><Label optional>Berakhir</Label><Input type="date" defaultValue="2026-12-20" /></div>
              <Switch checked label="Tampilkan sebagai Program Pilihan" description="Muncul di hero beranda" />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Target penggalangan</h2>
            <div className="mt-3"><Switch checked={hasTarget} onChange={setHasTarget} label="Gunakan target" description="Tanpa target, progres ditampilkan sebagai jumlah terkumpul" /></div>
            {hasTarget && <div className="mt-3"><Label>Target</Label><Input className="tabular" defaultValue="Rp125.000.000" /></div>}
            <div className="mt-4 rounded-xl bg-muted p-3 text-sm"><p className="text-ink-faint">Terkumpul (otomatis)</p><p className="tabular text-lg font-bold">{rupiah(c.collected)}</p><p className="text-xs text-ink-faint">Hanya bertambah dari pembayaran terverifikasi</p></div>
          </Card>
          <Card>
            <CardHeader title="Berita campaign" action={<Button variant="ghost" size="sm" onClick={() => go('admin-news')}><Plus className="h-4 w-4" /></Button>} />
            <ul className="divide-y divide-border p-2">{news.map((n) => <li key={n.slug} className="px-3 py-2.5"><p className="truncate text-sm font-medium">{n.title}</p><p className="text-xs text-ink-faint">{n.date}</p></li>)}</ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold text-danger">Zona berbahaya</h2>
            <Button variant="outline" size="sm" block className="mt-3"><Archive className="h-4 w-4" />Arsipkan campaign</Button>
            <Button variant="ghost" size="sm" block className="mt-1 text-ink-faint" disabled><Trash2 className="h-4 w-4" />Hapus (hanya draf tanpa transaksi)</Button>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

/* ================= News management ================= */
export function AdminNewsPage() {
  const state = useMockState();
  const [editing, setEditing] = useState(true);
  const rows = state === 'empty' ? [] : [...news.map((n) => ({ ...n, status: 'published' as const })), { slug: 'draft-1', campaign: 'c2', date: '—', title: 'Distribusi Paket Sekolah Gelombang 1 di Bogor', excerpt: '', status: 'draft' as const }];
  return (
    <AdminShell active="admin-news" title="Berita" description="Kabar perkembangan & penyaluran per campaign" actions={<Button onClick={() => setEditing(true)}><Plus className="h-4 w-4" />Tulis Berita</Button>}>
      <div className={cn('grid gap-5', editing && 'xl:grid-cols-[1fr_460px]')}>
        <Card>
          <div className="flex flex-wrap gap-2 border-b border-border p-4">
            <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><Input className="h-10 pl-9" placeholder="Cari judul berita…" /></div>
            <Select><option>Semua campaign</option>{campaigns.map((c) => <option key={c.id}>{c.title.slice(0, 40)}</option>)}</Select>
            <Select><option>Semua status</option><option>Terbit</option><option>Draf</option></Select>
          </div>
          {state === 'loading' && <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
          {state === 'error' && <ErrorState />}
          {state === 'empty' && <EmptyState title="Belum ada berita" description="Laporkan perkembangan program agar donatur makin percaya." />}
          {state === 'ready' && (
            <Table head={['Judul', 'Campaign', 'Status', 'Terbit', '']}>
              {rows.map((n) => (
                <tr key={n.slug} className="hover:bg-muted/40">
                  <Td className="max-w-[280px]"><p className="truncate font-medium">{n.title}</p></Td>
                  <Td className="max-w-[200px] truncate text-ink-faint">{campaigns.find((c) => c.id === n.campaign)?.title}</Td>
                  <Td>{n.status === 'published' ? <Badge tone="success" dot>Terbit</Badge> : <Badge dot>Draf</Badge>}</Td>
                  <Td className="whitespace-nowrap text-ink-faint">{n.date}</Td>
                  <Td><Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {editing && (
          <Card className="p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Edit berita</h2><Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Tutup</Button></div>
            <div className="mt-4 space-y-4">
              <div><Label>Campaign</Label><Select className="h-11 w-full"><option>{campaigns[1].title}</option></Select></div>
              <div><Label>Judul</Label><Input defaultValue="Distribusi Paket Sekolah Gelombang 1 di Bogor" /></div>
              <div><Label>Slug</Label><Input className="font-mono text-xs" defaultValue="distribusi-paket-sekolah-gelombang-1-bogor" /></div>
              <div><Label>Ringkasan</Label><Textarea rows={2} defaultValue="Sebanyak 120 paket telah diterimakan kepada anak yatim di 3 panti asuhan wilayah Bogor." /></div>
              <div>
                <Label>Konten</Label>
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="flex gap-1 border-b border-border bg-muted/60 p-1.5">{[Bold, Italic, List, Link2, ImagePlus].map((I, i) => <button key={i} className="rounded-md p-1.5 hover:bg-surface"><I className="h-4 w-4" /></button>)}</div>
                  <div className="prose-tk min-h-[120px] p-4 text-sm"><p>Alhamdulillah, Sabtu (7/11) tim kami menyalurkan 120 paket sekolah lengkap…</p></div>
                </div>
              </div>
              <div><Label>Gambar utama</Label><div className="flex items-center gap-3"><ImagePh hue={40} className="h-16 w-24" label="Gambar berita" /><Input className="h-9 text-xs" placeholder="Teks alternatif (wajib)" defaultValue="Anak-anak panti menerima tas sekolah baru" /></div></div>
              <details className="rounded-xl border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">SEO</summary><div className="mt-3 space-y-3"><Input placeholder="SEO title" /><Textarea rows={2} placeholder="SEO description (≤160)" /></div></details>
              <div className="flex gap-2 border-t border-border pt-4"><Button variant="outline" className="flex-1">Simpan Draf</Button><Button className="flex-1">Terbitkan</Button></div>
            </div>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
