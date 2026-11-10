import { useState } from 'react';
import { Check, Clock, Copy, Users } from 'lucide-react';
import { categories, type Campaign } from '@/data/sample';
import { cn, percent, rupiah } from '@/lib/utils';
import { go } from '@/lib/mock-state';
import { Avatar, Badge, Progress } from '@/components/ui/primitives';
import { ImagePh } from '@/components/ui/shared';

export function categoryOf(slug: string) {
  return categories.find((c) => c.slug === slug) ?? categories[categories.length - 1];
}

export function DaysLabel({ c }: { c: Campaign }) {
  if (c.status === 'completed') return <span className="text-ink-faint">Selesai</span>;
  if (c.daysLeft === null) return <span className="text-ink-faint">Berlangsung</span>;
  return <span className={cn(c.daysLeft <= 5 ? 'font-semibold text-danger' : 'text-ink-faint')}>{c.daysLeft} hari lagi</span>;
}

export function FundProgress({ c, size = 'sm' }: { c: Campaign; size?: 'sm' | 'lg' }) {
  const p = percent(c.collected, c.target);
  return (
    <div>
      {c.target ? <Progress value={p} className={size === 'lg' ? 'h-2.5' : 'h-1.5'} /> : <div className={cn('rounded-full bg-gold-soft', size === 'lg' ? 'h-2.5' : 'h-1.5')} />}
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className={cn('tabular font-bold text-primary-ink', size === 'lg' ? 'text-2xl' : 'text-sm')}>{rupiah(c.collected)}</p>
          <p className="text-xs text-ink-faint">{c.target ? <>terkumpul dari {rupiah(c.target)}</> : 'terkumpul · tanpa target'}</p>
        </div>
        {c.target && <span className="text-xs font-semibold text-ink-soft">{p}%</span>}
      </div>
    </div>
  );
}

export function CampaignCard({ c, layout = 'vertical' }: { c: Campaign; layout?: 'vertical' | 'horizontal' }) {
  const cat = categoryOf(c.category);
  if (layout === 'horizontal') {
    return (
      <button onClick={() => go('campaign-detail')} className="flex w-full gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition hover:shadow-lift">
        <ImagePh hue={c.hue} icon={cat.icon} label={c.title} className="h-24 w-28 shrink-0 sm:h-28 sm:w-36" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{c.title}</p>
          <p className="mt-1 text-xs text-ink-faint">{cat.name}</p>
          <div className="mt-auto pt-2"><FundProgress c={c} /></div>
        </div>
      </button>
    );
  }
  return (
    <button onClick={() => go('campaign-detail')} className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative">
        <ImagePh hue={c.hue} icon={cat.icon} label={c.title} className="aspect-[16/10] w-full" rounded="rounded-none" />
        <Badge tone="neutral" className="absolute left-3 top-3 bg-white/90">{cat.name}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 font-semibold leading-snug text-ink">{c.title}</p>
        <div className="mt-auto pt-4"><FundProgress c={c} /></div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="flex items-center gap-1 text-ink-faint"><Users className="h-3.5 w-3.5" />{c.donors.toLocaleString('id-ID')} donasi</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-ink-faint" /><DaysLabel c={c} /></span>
        </div>
      </div>
    </button>
  );
}

export function CategoryChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filter kategori">
      {[{ slug: 'semua', name: 'Semua', icon: null }, ...categories].map((c) => {
        const Icon = c.icon;
        const active = value === c.slug;
        return (
          <button key={c.slug} role="tab" aria-selected={active} onClick={() => onChange(c.slug)} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition', active ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-ink-soft hover:border-primary/40')}>
            {Icon && <Icon className="h-4 w-4" />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function DonorRow({ name, amount, ago, prayer }: { name: string; amount: number; ago: string; prayer?: string }) {
  return (
    <li className="flex gap-3 py-3">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="tabular shrink-0 text-sm font-semibold text-primary-ink">{rupiah(amount)}</p>
        </div>
        <p className="text-xs text-ink-faint">{ago}</p>
        {prayer && <p className="mt-1.5 rounded-lg bg-muted px-3 py-2 text-xs italic text-ink-soft">“{prayer}”</p>}
      </div>
    </li>
  );
}

export function CopyField({ label, value, display, mono }: { label: string; value: string; display?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-faint">{label}</p>
        <p className={cn('tabular font-bold text-ink', mono ? 'break-all font-mono text-base tracking-wide sm:text-lg' : 'truncate text-lg')}>{display ?? value}</p>
      </div>
      <button
        onClick={() => { navigator.clipboard?.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-soft"
        aria-label={`Salin ${label}`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Tersalin' : 'Salin'}
      </button>
    </div>
  );
}
