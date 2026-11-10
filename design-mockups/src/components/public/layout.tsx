import type { ReactNode } from 'react';
import { ArrowLeft, Home, LayoutGrid, LogIn, ReceiptText, ShieldCheck, UserRound, Instagram, Youtube, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { go } from '@/lib/mock-state';
import { Logo } from '@/components/ui/shared';
import { Button } from '@/components/ui/primitives';

export function PublicHeader({ loggedIn }: { loggedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <button onClick={() => go('home')} aria-label="Beranda"><Logo /></button>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          <Button variant="ghost" size="sm" onClick={() => go('home')}>Beranda</Button>
          <Button variant="ghost" size="sm" onClick={() => go('campaign-detail')}>Program</Button>
          <Button variant="ghost" size="sm">Tentang Kami</Button>
          {loggedIn ? (
            <Button variant="secondary" size="sm" onClick={() => go('donor-dashboard')}><UserRound className="h-4 w-4" />Akun Saya</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => go('donor-login')}><LogIn className="h-4 w-4" />Masuk</Button>
          )}
        </nav>
        <Button className="md:hidden" variant="ghost" size="sm" onClick={() => go(loggedIn ? 'donor-dashboard' : 'donor-login')}>
          {loggedIn ? <UserRound className="h-5 w-5" /> : 'Masuk'}
        </Button>
      </div>
    </header>
  );
}

export function BottomNav({ active }: { active: 'home' | 'program' | 'donasi' | 'akun' }) {
  const items = [
    { id: 'home', label: 'Beranda', icon: Home, page: 'home' },
    { id: 'program', label: 'Program', icon: LayoutGrid, page: 'campaign-detail' },
    { id: 'donasi', label: 'Donasi Saya', icon: ReceiptText, page: 'donor-transactions' },
    { id: 'akun', label: 'Akun', icon: UserRound, page: 'donor-dashboard' },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navigasi bawah">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ id, label, icon: Icon, page }) => (
          <button key={id} onClick={() => go(page)} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', active === id ? 'text-primary' : 'text-ink-faint')} aria-current={active === id ? 'page' : undefined}>
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 bg-primary-ink pb-24 text-white/80 md:pb-0">
      <div className="pattern-islamic">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo light />
            <p className="mt-3 max-w-sm text-sm leading-relaxed">Platform donasi yang amanah dan transparan. Setiap rupiah tercatat, setiap penyaluran dilaporkan.</p>
            <p className="mt-4 flex items-center gap-2 text-xs"><ShieldCheck className="h-4 w-4 text-gold-soft" />Pembayaran diproses oleh payment gateway berizin Bank Indonesia.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Tentang</p>
            <ul className="mt-3 space-y-2 text-sm"><li>Tentang Kami</li><li>Laporan Penyaluran</li><li>Kebijakan Privasi</li><li>Syarat & Ketentuan</li></ul>
          </div>
          <div>
            <p className="font-semibold text-white">Hubungi Kami</p>
            <ul className="mt-3 space-y-2 text-sm"><li className="flex items-center gap-2"><Mail className="h-4 w-4" />halo@tebarkebaikan.org</li><li>Jl. Contoh Raya No. 12, Jakarta</li></ul>
            <div className="mt-3 flex gap-3"><Instagram className="h-5 w-5" aria-label="Instagram" /><Youtube className="h-5 w-5" aria-label="YouTube" /></div>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs">© 2026 Yayasan Tebar Kebaikan (nama contoh)</p>
      </div>
    </footer>
  );
}

export function PublicLayout({ children, nav = 'home', loggedIn, hideBottomNav, hideFooter }: { children: ReactNode; nav?: 'home' | 'program' | 'donasi' | 'akun'; loggedIn?: boolean; hideBottomNav?: boolean; hideFooter?: boolean }) {
  return (
    <div className="min-h-screen bg-bg">
      <PublicHeader loggedIn={loggedIn} />
      <main>{children}</main>
      {!hideFooter && <Footer />}
      {!hideBottomNav && <BottomNav active={nav} />}
    </div>
  );
}

/* Layout alur donasi: fokus, tanpa navigasi yang mengalihkan */
export function FlowLayout({ title, back, step, children, footer }: { title: string; back?: string; step?: 1 | 2 | 3; children: ReactNode; footer?: ReactNode }) {
  const steps = ['Nominal & Data', 'Pembayaran', 'Selesaikan'];
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          {back && <button onClick={() => go(back)} aria-label="Kembali" className="-ml-2 rounded-lg p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>}
          <h1 className="font-semibold">{title}</h1>
          <span className="ml-auto flex items-center gap-1 text-xs text-ink-faint"><ShieldCheck className="h-4 w-4 text-primary" />Aman</span>
        </div>
        {step && (
          <ol className="mx-auto flex max-w-2xl gap-2 px-4 pb-3" aria-label="Langkah donasi">
            {steps.map((s, i) => (
              <li key={s} className="flex-1">
                <div className={cn('h-1 rounded-full', i < step ? 'bg-primary' : 'bg-border')} />
                <p className={cn('mt-1.5 text-[11px] font-medium', i < step ? 'text-primary' : 'text-ink-faint')}>{i + 1}. {s}</p>
              </li>
            ))}
          </ol>
        )}
      </header>
      <main className={cn('mx-auto max-w-2xl px-4 py-5', !!footer && 'pb-32')}>{children}</main>
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-cta">
          <div className="mx-auto max-w-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        </div>
      )}
    </div>
  );
}
