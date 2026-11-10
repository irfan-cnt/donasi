import { useState } from 'react';
import { BadgeCheck, CalendarDays, ChevronDown, ChevronRight, Info, Share2, Users } from 'lucide-react';
import { campaigns, news, recentDonors } from '@/data/sample';
import { rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { PublicLayout } from '@/components/public/layout';
import { DaysLabel, DonorRow, FundProgress, categoryOf } from '@/components/public/campaign';
import { Alert, Badge, Button, Card, Skeleton } from '@/components/ui/primitives';
import { ErrorState, ImagePh } from '@/components/ui/shared';

export default function CampaignDetailPage({ status = 'published' }: { status?: 'published' | 'paused' | 'completed' }) {
  const state = useMockState();
  const c = { ...campaigns[0], status };
  const cat = categoryOf(c.category);
  const [open, setOpen] = useState(false);
  const [fund, setFund] = useState(true);
  const canDonate = c.status === 'published';

  if (state === 'error') return <PublicLayout nav="program"><div className="mx-auto max-w-3xl px-4 py-16"><ErrorState title="Program tidak dapat dimuat" /></div></PublicLayout>;

  return (
    <PublicLayout nav="program" hideBottomNav>
      <div className="mx-auto max-w-6xl px-0 md:px-4 md:pt-6">
        <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8">
          {/* Kiri */}
          <div>
            {state === 'loading' ? <Skeleton className="aspect-[16/9] w-full rounded-none md:rounded-2xl" /> : (
              <div>
                <ImagePh hue={c.hue} icon={cat.icon} label="Warga desa mengantre air di sumber air terdekat" className="aspect-[16/9] w-full md:rounded-2xl" rounded="rounded-none" />
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4 md:px-0" aria-label="Galeri">
                  {[0, 1, 2, 3].map((i) => <ImagePh key={i} hue={c.hue + i * 12} label={`Foto galeri ${i + 1}`} className="h-14 w-20 shrink-0" />)}
                </div>
              </div>
            )}

            <div className="px-4 md:px-0">
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Badge tone="primary">{cat.name}</Badge>
                <Badge tone="neutral"><BadgeCheck className="h-3.5 w-3.5 text-primary" />Terverifikasi</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">{c.title}</h1>

              {/* Ringkasan mobile */}
              <Card className="mt-5 p-4 md:hidden">
                <FundProgress c={c} size="lg" />
                <div className="mt-3 flex justify-between text-sm"><span className="flex items-center gap-1 text-ink-faint"><Users className="h-4 w-4" />{c.donors.toLocaleString('id-ID')} donasi</span><DaysLabel c={c} /></div>
              </Card>

              {!canDonate && (
                <Alert className="mt-4" tone={c.status === 'paused' ? 'warning' : 'info'} title={c.status === 'paused' ? 'Donasi sementara dijeda' : 'Program telah selesai'}>
                  {c.status === 'paused' ? 'Pengelola sedang memperbarui informasi program. Silakan kembali beberapa saat lagi.' : 'Terima kasih kepada seluruh donatur. Lihat laporan penyaluran di bawah.'}
                </Alert>
              )}

              {/* Cerita */}
              <section className="mt-6">
                <h2 className="text-lg font-bold">Tentang program</h2>
                <div className={open ? 'prose-tk mt-3' : 'prose-tk relative mt-3 max-h-48 overflow-hidden'}>
                  <p><strong>Setiap pagi, Mama Yuliana berjalan 4 kilometer membawa dua jeriken.</strong> Di Desa Oebelo, Kupang, sumber air terdekat hanya mengalir di musim hujan. Saat kemarau, 300 keluarga bergantung pada air yang keruh dan dibeli mahal.</p>
                  <p>Bersama aparat desa dan tim geolistrik, kami telah menemukan titik air di kedalaman ±80 meter. Dana yang terkumpul digunakan untuk:</p>
                  <ul><li>Survei geolistrik dan pengeboran 100 m</li><li>Pompa submersible tenaga surya</li><li>Tandon 10.000 liter dan 4 titik kran umum</li><li>Pelatihan perawatan untuk pengurus air desa</li></ul>
                  <h3>Target manfaat</h3>
                  <p>300 keluarga (±1.200 jiwa) mendapatkan akses air bersih yang dekat, termasuk madrasah dan mushola desa.</p>
                  {!open && <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent" />}
                </div>
                <button onClick={() => setOpen(!open)} className="mt-2 flex items-center gap-1 text-sm font-semibold text-primary">{open ? 'Tutup' : 'Baca selengkapnya'}<ChevronDown className={open ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /></button>
              </section>

              {/* Transparansi */}
              <section className="mt-6">
                <Card>
                  <button onClick={() => setFund(!fund)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                    <span className="font-bold">Rincian penggunaan dana</span><ChevronDown className={fund ? 'h-5 w-5 rotate-180' : 'h-5 w-5'} />
                  </button>
                  {fund && (
                    <dl className="space-y-2.5 border-t border-border px-5 py-4 text-sm">
                      {[
                        ['Dana terkumpul', c.collected],
                        ['Disalurkan ke program', -c.disbursed],
                        ['Biaya operasional (5%)', -c.opsFee],
                        ['Biaya transaksi bank/gateway', -c.bankFee],
                      ].map(([l, v]) => (
                        <div key={l as string} className="flex justify-between"><dt className="text-ink-soft">{l}</dt><dd className="tabular font-medium">{(v as number) < 0 ? '− ' : ''}{rupiah(Math.abs(v as number))}</dd></div>
                      ))}
                      <div className="flex justify-between border-t border-dashed border-border pt-2.5 font-bold"><dt>Dana tersedia</dt><dd className="tabular text-primary-ink">{rupiah(c.collected - c.disbursed - c.opsFee - c.bankFee)}</dd></div>
                      <p className="flex gap-1.5 pt-1 text-xs text-ink-faint"><Info className="h-3.5 w-3.5 shrink-0" />Diperbarui setiap ada penyaluran. Bukti penyaluran tersedia di kabar terbaru.</p>
                    </dl>
                  )}
                </Card>
              </section>

              {/* Berita */}
              <section className="mt-8">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Kabar terbaru</h2><span className="text-sm text-ink-faint">{news.length} kabar</span></div>
                <ol className="relative mt-4 space-y-5 border-l-2 border-primary-soft pl-5">
                  {news.map((n) => (
                    <li key={n.slug} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
                      <p className="flex items-center gap-1 text-xs text-ink-faint"><CalendarDays className="h-3.5 w-3.5" />{n.date}</p>
                      <button onClick={() => go('news-detail')} className="mt-1 text-left font-semibold leading-snug hover:text-primary">{n.title}</button>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-faint">{n.excerpt}</p>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Donatur */}
              <section className="mt-8">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Donatur & doa</h2><span className="text-sm text-ink-faint">{c.donors.toLocaleString('id-ID')} donasi</span></div>
                {state === 'loading' ? <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> : (
                  <ul className="mt-2 divide-y divide-border">{recentDonors.map((d, i) => <DonorRow key={i} {...d} />)}</ul>
                )}
                <Button variant="outline" block className="mt-3">Lihat semua donatur</Button>
              </section>
            </div>
          </div>

          {/* Kanan (desktop sticky) */}
          <aside className="hidden md:block">
            <Card className="sticky top-24 p-5">
              <FundProgress c={c} size="lg" />
              <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                <div className="rounded-xl bg-muted py-2.5"><p className="font-bold">{c.donors.toLocaleString('id-ID')}</p><p className="text-xs text-ink-faint">donasi</p></div>
                <div className="rounded-xl bg-muted py-2.5"><p className="font-bold"><DaysLabel c={c} /></p><p className="text-xs text-ink-faint">tenggat</p></div>
              </div>
              <Button size="lg" block className="mt-5" disabled={!canDonate} onClick={() => go('checkout-open')}>{canDonate ? 'Donasi Sekarang' : c.status === 'paused' ? 'Donasi dijeda' : 'Program selesai'}</Button>
              <Button variant="outline" block className="mt-2"><Share2 className="h-4 w-4" />Bagikan</Button>
              <p className="mt-4 text-center text-xs text-ink-faint">Dikelola oleh Yayasan Tebar Kebaikan · Kuitansi otomatis</p>
            </Card>
          </aside>
        </div>
      </div>

      {/* Sticky CTA mobile */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-cta md:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <Button variant="outline" size="lg" aria-label="Bagikan" className="px-4"><Share2 className="h-5 w-5" /></Button>
          <Button size="lg" block disabled={!canDonate} onClick={() => go('checkout-open')}>{canDonate ? 'Donasi Sekarang' : c.status === 'paused' ? 'Donasi dijeda' : 'Program selesai'}{canDonate && <ChevronRight className="h-5 w-5" />}</Button>
        </div>
      </div>
      <div className="h-20 md:hidden" />
    </PublicLayout>
  );
}
