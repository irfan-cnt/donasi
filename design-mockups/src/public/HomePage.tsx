import { useState } from 'react';
import { ArrowRight, BadgeCheck, FileText, HandCoins, HeartHandshake, ShieldCheck, Users } from 'lucide-react';
import { campaigns } from '@/data/sample';
import { rupiah } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { PublicLayout } from '@/components/public/layout';
import { CampaignCard, CategoryChips, FundProgress, categoryOf } from '@/components/public/campaign';
import { Badge, Button, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState, ImagePh, ListSkeleton } from '@/components/ui/shared';

export default function HomePage() {
  const state = useMockState();
  const [cat, setCat] = useState('semua');
  const featured = campaigns[0];
  const live = campaigns.filter((c) => c.status === 'published');
  const list = state === 'empty' ? [] : live.filter((c) => cat === 'semua' || c.category === cat);

  return (
    <PublicLayout nav="home">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-ink text-white">
        <div className="pattern-islamic absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-8 md:grid-cols-2 md:items-center md:py-16">
          <div>
            <Badge tone="gold" className="bg-white/10 text-gold-soft">#TebarKebaikan</Badge>
            <h1 className="mt-4 font-display text-[2rem] font-bold leading-tight md:text-5xl">Kebaikan kecil, dampak yang nyata.</h1>
            <p className="mt-3 max-w-md text-white/75">Donasi dalam hitungan detik — tanpa perlu daftar. Setiap rupiah tercatat dan penyalurannya dilaporkan.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" variant="gold" onClick={() => go('checkout-open')}>Donasi Sekarang</Button>
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go('campaign-detail')}>Lihat Program <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
          {state === 'loading' ? (
            <Skeleton className="h-64 rounded-2xl bg-white/10" />
          ) : (
            <button onClick={() => go('campaign-detail')} className="overflow-hidden rounded-2xl bg-surface text-left text-ink shadow-lift">
              <ImagePh hue={featured.hue} icon={categoryOf(featured.category).icon} label={featured.title} className="aspect-[16/8] w-full" rounded="rounded-none" />
              <div className="p-4">
                <Badge tone="primary">Program Pilihan</Badge>
                <p className="mt-2 font-semibold leading-snug">{featured.title}</p>
                <div className="mt-3"><FundProgress c={featured} /></div>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto -mt-5 max-w-6xl px-4">
        <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface py-4 shadow-card">
          {[
            { icon: HandCoins, v: rupiah(4_812_000_000).replace(',00', ''), l: 'Tersalurkan' },
            { icon: Users, v: '58.240', l: 'Donasi' },
            { icon: FileText, v: '214', l: 'Laporan' },
          ].map(({ icon: Icon, v, l }) => (
            <div key={l} className="flex flex-col items-center px-2 text-center">
              <Icon className="h-5 w-5 text-gold" />
              <p className="tabular mt-1 text-sm font-bold sm:text-lg">{v}</p>
              <p className="text-xs text-ink-faint">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured row */}
      <section className="mx-auto mt-10 max-w-6xl px-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Butuh bantuan segera</h2>
            <p className="text-sm text-ink-faint">Program dengan tenggat terdekat</p>
          </div>
        </div>
        <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0">
          {state === 'loading'
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-80 w-72 shrink-0 rounded-2xl md:w-auto" />)
            : [campaigns[4], campaigns[2], campaigns[1]].map((c) => (
                <div key={c.id} className="w-72 shrink-0 snap-start md:w-auto"><CampaignCard c={c} /></div>
              ))}
        </div>
      </section>

      {/* Category + list */}
      <section className="mx-auto mt-10 max-w-6xl px-4">
        <h2 className="text-xl font-bold">Pilih program kebaikan</h2>
        <div className="mt-4"><CategoryChips value={cat} onChange={setCat} /></div>
        <div className="mt-5">
          {state === 'loading' && <ListSkeleton rows={4} />}
          {state === 'error' && <ErrorState />}
          {(state === 'ready' || state === 'empty') && list.length === 0 && (
            <EmptyState icon={HeartHandshake} title="Belum ada program di kategori ini" description="Program kebaikan baru segera hadir. Coba lihat kategori lain." action={<Button variant="outline" size="sm" onClick={() => setCat('semua')}>Lihat semua program</Button>} />
          )}
          {state === 'ready' && list.length > 0 && (
            <>
              <div className="grid gap-3 md:hidden">{list.map((c) => <CampaignCard key={c.id} c={c} layout="horizontal" />)}</div>
              <div className="hidden gap-5 md:grid md:grid-cols-3">{list.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
              <div className="mt-6 text-center"><Button variant="outline">Muat lebih banyak</Button></div>
            </>
          )}
        </div>
      </section>

      {/* How it works / transparency */}
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="grid gap-4 rounded-2xl border border-border bg-surface p-6 md:grid-cols-3 md:p-8">
          {[
            { icon: HeartHandshake, t: 'Pilih program', d: 'Semua program diverifikasi tim kami sebelum tayang.' },
            { icon: ShieldCheck, t: 'Bayar dengan aman', d: 'QRIS, e-wallet, atau virtual account. Tanpa perlu membuat akun.' },
            { icon: BadgeCheck, t: 'Pantau penyaluran', d: 'Kuitansi otomatis dan kabar penyaluran langsung ke email/WhatsApp.' },
          ].map(({ icon: Icon, t, d }, i) => (
            <div key={t} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" /></span>
              <div>
                <p className="text-xs font-semibold text-gold">Langkah {i + 1}</p>
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-sm text-ink-faint">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
