import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg' | 'icon';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  secondary: 'bg-primary-soft text-primary-ink hover:bg-primary-soft/70',
  outline: 'border border-border bg-surface text-ink hover:bg-muted',
  ghost: 'text-ink-soft hover:bg-muted hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90',
  gold: 'bg-gold text-white hover:bg-gold/90',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
  icon: 'h-10 w-10 rounded-xl',
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; block?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', block, className, ...p }, ref) {
  return (
    <button ref={ref} className={cn('inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50', variants[variant], sizes[size], block && 'w-full', className)} {...p} />
  );
});

/* ---------- Card ---------- */
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0 rounded-2xl border border-border bg-surface shadow-card', className)} {...p} />;
}
export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-faint">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
const tones: Record<Tone, string> = {
  neutral: 'bg-muted text-ink-soft',
  primary: 'bg-primary-soft text-primary-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  gold: 'bg-gold-soft text-gold',
};
export function Badge({ tone = 'neutral', className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Form ---------- */
export function Label({ children, htmlFor, optional, className }: { children: ReactNode; htmlFor?: string; optional?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-ink', className)}>
      {children} {optional && <span className="font-normal text-ink-faint">(opsional)</span>}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...p }, ref) {
  return (
    <input ref={ref} className={cn('h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/30', invalid ? 'border-danger' : 'border-border focus:border-primary', className)} {...p} />
  );
});
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30', className)} {...p} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('h-10 rounded-xl border border-border bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30', className)} {...p}>
      {children}
    </select>
  );
}
export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="h-3.5 w-3.5" />{children}</p>;
}
export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange?: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange?.(!checked)} className="flex w-full items-start justify-between gap-4 text-left">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-faint">{description}</span>}
      </span>
      <span className={cn('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-border')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}
export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange?: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft">
      <input type="checkbox" checked={checked} onChange={(e) => onChange?.(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-[rgb(var(--primary))]" />
      <span>{children}</span>
    </label>
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, className, tone = 'primary' }: { value: number; className?: string; tone?: 'primary' | 'gold' }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', tone === 'gold' ? 'bg-gold' : 'bg-primary')} style={{ width: `${value}%` }} />
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('relative overflow-hidden rounded-lg bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent', className)} />;
}

/* ---------- Alert ---------- */
const alertTone = {
  info: { cls: 'bg-info-soft text-info border-info/20', icon: Info },
  success: { cls: 'bg-success-soft text-success border-success/20', icon: CheckCircle2 },
  warning: { cls: 'bg-warning-soft text-warning border-warning/20', icon: TriangleAlert },
  danger: { cls: 'bg-danger-soft text-danger border-danger/20', icon: AlertCircle },
};
export function Alert({ tone = 'info', title, children, className }: { tone?: keyof typeof alertTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, icon: Icon } = alertTone[tone];
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', cls, className)} role="status">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="mt-0.5 text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}

/* ---------- Tabs (segmented) ---------- */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-xl bg-muted p-1', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition', value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-ink', className)}>{initials}</span>;
}

/* ---------- Divider ---------- */
export const Divider = ({ className }: { className?: string }) => <hr className={cn('border-border', className)} />;
