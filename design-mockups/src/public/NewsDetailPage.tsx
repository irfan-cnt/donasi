import { CalendarDays, ChevronLeft, Share2 } from 'lucide-react';
import { campaigns, news } from '@/data/sample';
import { go, useMockState } from '@/lib/mock-state';
import { PublicLayout } from '@/components/public/layout';
import { FundProgress, categoryOf } from '@/components/public/campaign';
import { Button, Card, Skeleton } from '@/components/ui/primitives';
import { ErrorState, ImagePh } from '@/components/ui/shared';

export default function NewsDetailPage() {
  const state = useMockState();
  const c = campaigns[0];
  const n = news[1];
  return (
    <PublicLayout nav="program">
      <article className="mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => go('campaign-detail')} className="flex items-center gap-1 text-sm font-medium text-primary"><ChevronLeft className="h-4 w-4" />Kembali ke program</button>
        {state === 'error' ? <ErrorState title="Kabar tidak dapat dimuat" /> : state === 'loading' ? (
          <div className="mt-6 space-y-4"><Skeleton className="h-8 w-4/5" /><Skeleton className="h-4 w-40" /><Skeleton className="aspect-[16/9] w-full" /><Skeleton className="h-24 w-full" /></div>
        ) : (
          <>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gold">Kabar Penyaluran</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight md:text-3xl">{n.title}</h1>
            <div className="mt-3 flex items-center justify-between text-sm text-ink-faint">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{n.date} · Tim Program</span>
              <Button variant="ghost" size="sm"><Share2 className="h-4 w-4" />Bagikan</Button>
            </div>
            <ImagePh hue={c.hue + 20} label="Tim relawan menyerahkan alat pengeboran kepada kepala desa" className="mt-5 aspect-[16/9] w-full rounded-2xl" />
            <p className="mt-2 text-center text-xs text-ink-faint">Serah terima alat pengeboran kepada pengurus air Desa Oebelo.</p>
            <div className="prose-tk mt-6">
              <p>Alhamdulillah, berkat dukungan 1.420 donatur, dana tahap pertama sebesar <strong>Rp95.000.000</strong> telah disalurkan pada 18 Oktober 2026 untuk memulai pekerjaan di Desa Oebelo.</p>
              <h3>Rincian penyaluran tahap 1</h3>
              <ul>
                <li>Survei geolistrik 3 titik — Rp12.500.000</li>
                <li>Sewa alat bor & operator (20 hari) — Rp48.000.000</li>
                <li>Pipa casing PVC 6 inci, 100 m — Rp21.500.000</li>
                <li>Transportasi material & logistik tim — Rp13.000.000</li>
              </ul>
              <p>Pekerjaan berikutnya adalah pemasangan pompa tenaga surya dan tandon. Kami akan melaporkan setiap tahap beserta bukti nota di halaman ini.</p>
              <p>Jazakumullah khairan katsiran atas amanah yang dititipkan.</p>
            </div>
          </>
        )}

        <Card className="mt-8 p-4">
          <p className="text-xs font-semibold text-ink-faint">Program terkait</p>
          <div className="mt-3 flex gap-3">
            <ImagePh hue={c.hue} icon={categoryOf(c.category).icon} className="h-20 w-24 shrink-0" label={c.title} />
            <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{c.title}</p><div className="mt-2"><FundProgress c={c} /></div></div>
          </div>
          <Button block className="mt-4" onClick={() => go('checkout-open')}>Lanjutkan Kebaikan Ini</Button>
        </Card>

        <section className="mt-8">
          <h2 className="font-bold">Kabar lain dari program ini</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {news.filter((x) => x.slug !== n.slug).map((x) => (
              <li key={x.slug}><button className="w-full px-4 py-3 text-left hover:bg-muted"><p className="text-xs text-ink-faint">{x.date}</p><p className="text-sm font-semibold">{x.title}</p></button></li>
            ))}
          </ul>
        </section>
      </article>
    </PublicLayout>
  );
}
