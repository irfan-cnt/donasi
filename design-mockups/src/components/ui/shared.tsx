import type { ReactNode } from 'react';
import { CircleSlash2, RefreshCw, WifiOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Skeleton } from './primitives';
import type { TrxStatus } from '@/data/sample';

/* ---------- Logo (orisinal: tetesan + daun) ---------- */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? '#ffffff' : 'rgb(13 110 86)'} />
        <path d="M16 6c4.5 5.2 7 9 7 12.2A7 7 0 0 1 9 18.2C9 15 11.5 11.2 16 6z" fill={light ? 'rgb(13 110 86)' : '#fff'} />
        <path d="M16 24v-7m0 2.5 3-2.5" stroke={light ? '#fff' : 'rgb(183 135 46)'} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
      <span className={cn('font-display text-lg font-bold leading-none tracking-tight', light ? 'text-white' : 'text-ink')}>
        Tebar<span className={light ? 'text-gold-soft' : 'text-primary'}>Kebaikan</span>
      </span>
    </span>
  );
}

/* ---------- Image placeholder (tanpa aset eksternal) ---------- */
export function ImagePh({ hue = 160, label, icon: Icon, className, rounded = 'rounded-xl' }: { hue?: number; label?: string; icon?: LucideIcon; className?: string; rounded?: string }) {
  return (
    <div
      role="img"
      aria-label={label ?? 'Ilustrasi program'}
      className={cn('relative flex items-center justify-center overflow-hidden', rounded, className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 78%), hsl(${(hue + 30) % 360} 40% 58%))` }}
    >
      <div className="pattern-islamic absolute inset-0" />
      <svg viewBox="0 0 200 120" className="absolute bottom-0 w-full opacity-40" preserveAspectRatio="none" aria-hidden>
        <path d="M0 90 Q50 60 100 85 T200 75 V120 H0z" fill={`hsl(${hue} 35% 35%)`} />
      </svg>
      {Icon && <Icon className="relative h-8 w-8 text-white/80" />}
    </div>
  );
}

/* ---------- Status transaksi ---------- */
const statusMap: Record<TrxStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  created: { label: 'Dibuat', tone: 'neutral' },
  pending: { label: 'Menunggu', tone: 'warning' },
  paid: { label: 'Berhasil', tone: 'success' },
  expired: { label: 'Kedaluwarsa', tone: 'neutral' },
  failed: { label: 'Gagal', tone: 'danger' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
  refunded: { label: 'Dikembalikan', tone: 'info' },
};
export function TrxStatusBadge({ status }: { status: TrxStatus }) {
  const s = statusMap[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

/* ---------- States ---------- */
export function EmptyState({ icon: Icon = CircleSlash2, title, description, action, className }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft pattern-islamic-dark">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-faint">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ title = 'Gagal memuat data', description = 'Periksa koneksi internetmu lalu coba lagi. Jika masalah berlanjut, hubungi kami dengan kode REQ-7F3A9.', className }: { title?: string; description?: string; className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={WifiOff}
      title={title}
      description={description}
      action={<Button variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Coba lagi</Button>}
    />
  );
}
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Memuat">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-16 w-20 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Stat ---------- */
export function Stat({ label, value, hint, icon: Icon, tone = 'primary' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: 'primary' | 'gold' | 'warning' | 'info' }) {
  const toneCls = { primary: 'bg-primary-soft text-primary', gold: 'bg-gold-soft text-gold', warning: 'bg-warning-soft text-warning', info: 'bg-info-soft text-info' }[tone];
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-faint">{label}</p>
        {Icon && <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneCls)}><Icon className="h-4 w-4" /></span>}
      </div>
      <p className="tabular mt-2 truncate text-lg font-bold text-ink sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/* ---------- Payment method logo (wordmark generik, bukan logo resmi) ---------- */
export function MethodMark({ name, color }: { name: string; color: string }) {
  const short = name.replace(' Virtual Account', '').slice(0, 9);
  return (
    <span className="inline-flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-[11px] font-extrabold tracking-tight" style={{ color }}>
      {short}
    </span>
  );
}
