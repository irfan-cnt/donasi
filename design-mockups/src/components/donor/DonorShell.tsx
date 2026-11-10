import type { ReactNode } from 'react';
import { LayoutDashboard, LogOut, ReceiptText, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { go } from '@/lib/mock-state';
import { PublicLayout } from '@/components/public/layout';
import { Avatar } from '@/components/ui/primitives';

const nav = [
  { id: 'donor-dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'donor-transactions', label: 'Riwayat Donasi', icon: ReceiptText },
  { id: 'donor-profile', label: 'Profil', icon: UserRound },
];

export function DonorShell({ active, title, children, action }: { active: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <PublicLayout loggedIn nav={active === 'donor-transactions' ? 'donasi' : 'akun'} hideFooter>
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:grid md:grid-cols-[240px_1fr] md:gap-8 md:pb-12">
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <Avatar name="Ahmad Fauzi" className="h-11 w-11" />
              <div className="min-w-0"><p className="truncate font-semibold">Ahmad Fauzi</p><p className="truncate text-xs text-ink-faint">ahmad.fauzi@example.com</p></div>
            </div>
            <nav className="mt-3 space-y-1" aria-label="Menu akun">
              {nav.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => go(id)} className={cn('flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium', active === id ? 'bg-primary-soft text-primary-ink' : 'text-ink-soft hover:bg-muted')} aria-current={active === id ? 'page' : undefined}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft"><LogOut className="h-4 w-4" />Keluar</button>
            </nav>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:hidden">
            {nav.map(({ id, label }) => (
              <button key={id} onClick={() => go(id)} className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium', active === id ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-ink-soft')}>{label}</button>
            ))}
          </div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">{title}</h1>
            {action}
          </div>
          {children}
        </div>
      </div>
    </PublicLayout>
  );
}
