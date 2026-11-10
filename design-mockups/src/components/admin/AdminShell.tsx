import { useState, type ReactNode } from 'react';
import { Bell, CreditCard, FileClock, LayoutDashboard, LogOut, Mail, Megaphone, Menu, Newspaper, ReceiptText, ScrollText, Search, Users, Webhook, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { go } from '@/lib/mock-state';
import { Logo } from '@/components/ui/shared';
import { Avatar, Badge } from '@/components/ui/primitives';

const groups = [
  { title: 'Utama', items: [{ id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { title: 'Konten', items: [
    { id: 'admin-campaigns', label: 'Campaign', icon: Megaphone },
    { id: 'admin-news', label: 'Berita', icon: Newspaper },
  ] },
  { title: 'Keuangan', items: [
    { id: 'admin-transactions', label: 'Transaksi', icon: ReceiptText },
    { id: 'admin-donors', label: 'Donatur', icon: Users },
    { id: 'admin-payment-methods', label: 'Metode Pembayaran', icon: CreditCard },
    { id: 'admin-payment-logs', label: 'Log Pembayaran', icon: Webhook },
  ] },
  { title: 'Notifikasi', items: [
    { id: 'admin-templates', label: 'Template', icon: Mail },
    { id: 'admin-notification-logs', label: 'Log Notifikasi', icon: FileClock },
  ] },
  { title: 'Sistem', items: [{ id: 'admin-audit', label: 'Audit Log', icon: ScrollText }] },
];

function SideNav({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-5" aria-label="Menu admin">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.title}</p>
          <div className="mt-1.5 space-y-0.5">
            {g.items.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { go(id); onNavigate?.(); }} className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition', active === id ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white')} aria-current={active === id ? 'page' : undefined}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ active, title, description, actions, children }: { active: string; title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-bg">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-primary-ink px-3 py-5 lg:flex">
        <div className="px-3"><Logo light /></div>
        <Badge tone="gold" className="mx-3 mt-3 w-fit bg-white/10 text-gold-soft">Panel Admin</Badge>
        <div className="mt-6 flex-1 overflow-y-auto"><SideNav active={active} /></div>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <Avatar name="Fajar Ramadhan" className="bg-white/15 text-white" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">Fajar Ramadhan</p><p className="text-xs text-white/50">Owner</p></div>
          <button aria-label="Keluar" className="text-white/60 hover:text-white"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-primary-ink px-3 py-5">
            <div className="flex items-center justify-between px-3"><Logo light /><button onClick={() => setOpen(false)} aria-label="Tutup menu" className="text-white"><X className="h-5 w-5" /></button></div>
            <div className="mt-6"><SideNav active={active} onNavigate={() => setOpen(false)} /></div>
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur lg:px-8">
          <button className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu className="h-5 w-5" /></button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input className="h-10 w-full rounded-xl border border-border bg-muted/60 pl-9 pr-3 text-sm placeholder:text-ink-faint focus:border-primary focus:outline-none" placeholder="Cari kode transaksi, donatur, campaign…" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="warning" className="hidden sm:inline-flex">Sandbox</Badge>
            <button className="relative rounded-lg p-2 hover:bg-muted" aria-label="Notifikasi"><Bell className="h-5 w-5" /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" /></button>
            <Avatar name="Fajar Ramadhan" className="lg:hidden" />
          </div>
        </header>
        <main className="min-w-0 px-4 py-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-2xl font-bold">{title}</h1>{description && <p className="mt-1 text-sm text-ink-faint">{description}</p>}</div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

/* ---------- Table helpers ---------- */
export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-ink-faint">{head.map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>;

export function Pagination({ total, shown }: { total: number; shown: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-ink-faint">
      <span>Menampilkan 1–{shown} dari {total.toLocaleString('id-ID')}</span>
      <div className="flex gap-1">
        {['‹', '1', '2', '3', '…', '›'].map((p, i) => <button key={i} className={cn('h-8 min-w-8 rounded-lg px-2 text-sm', p === '1' ? 'bg-primary text-white' : 'hover:bg-muted')}>{p}</button>)}
      </div>
    </div>
  );
}

/* ---------- Mini bar chart (SVG, tanpa dependensi) ---------- */
export function BarChart({ data, labels, height = 180 }: { data: number[]; labels?: string[]; height?: number }) {
  const max = Math.max(...data);
  const w = 100 / data.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Grafik donasi harian 30 hari">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2="100" y1={(height / 3) * g} y2={(height / 3) * g} stroke="rgb(var(--border))" strokeWidth="0.15" />)}
        {data.map((v, i) => {
          const h = (v / max) * (height / 3 - 2);
          return <rect key={i} x={i * w + w * 0.18} y={height / 3 - h} width={w * 0.64} height={h} rx="0.6" fill={i === data.length - 1 ? 'rgb(var(--gold))' : 'rgb(var(--primary))'} opacity={i === data.length - 1 ? 1 : 0.85}><title>{v.toLocaleString('id-ID')}</title></rect>;
        })}
      </svg>
      {labels && <div className="mt-2 flex justify-between text-[11px] text-ink-faint">{labels.map((l) => <span key={l}>{l}</span>)}</div>}
    </div>
  );
}
