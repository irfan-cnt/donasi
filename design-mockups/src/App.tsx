import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Laptop, Monitor, Smartphone, Tablet } from 'lucide-react';
import { pages, type Group } from '@/registry';
import { MockStateContext, type MockState } from '@/lib/mock-state';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/shared';
import { Badge } from '@/components/ui/primitives';

function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  const params = new URLSearchParams(query);
  const m = path.match(/^\/(p|v)\/([\w-]+)/);
  return { mode: (m?.[1] ?? 'index') as 'p' | 'v' | 'index', id: m?.[2] ?? '', state: (params.get('state') ?? 'ready') as MockState, frame: params.get('frame') === '1', w: params.get('w') };
}

const widths = [
  { w: '375', label: 'Mobile', icon: Smartphone },
  { w: '768', label: 'Tablet', icon: Tablet },
  { w: '1280', label: 'Laptop', icon: Laptop },
  { w: 'full', label: 'Penuh', icon: Monitor },
];
const states: MockState[] = ['ready', 'loading', 'empty', 'error'];
const stateLabel: Record<MockState, string> = { ready: 'Normal', loading: 'Loading', empty: 'Empty', error: 'Error' };

let frameBase: string | null = null;
function getFrameBase(): string {
  if (frameBase) return frameBase;
  const html = (window as unknown as { __selfHtml?: string }).__selfHtml;
  if (import.meta.env.MODE === 'single' && html) {
    frameBase = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  } else {
    frameBase = window.location.pathname;
  }
  return frameBase;
}

function Viewer({ id, state, w }: { id: string; state: MockState; w: string | null }) {
  const page = pages.find((p) => p.id === id) ?? pages[0];
  const width = w ?? (page.device === 'mobile' ? '375' : '1280');
  const idx = pages.indexOf(page);
  const set = (next: { id?: string; state?: MockState; w?: string }) => {
    window.location.hash = `#/v/${next.id ?? page.id}?state=${next.state ?? state}&w=${next.w ?? width}`;
  };
  return (
    <div className="flex h-screen flex-col bg-[#E9E7E1]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 text-sm">
        <a href="#/" className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-medium hover:bg-muted"><ArrowLeft className="h-4 w-4" />Indeks</a>
        <select className="h-9 max-w-[260px] rounded-lg border border-border bg-surface px-2" value={page.id} onChange={(e) => set({ id: e.target.value, w: pages.find((p) => p.id === e.target.value)!.device === 'mobile' ? '375' : '1280' })} aria-label="Pilih halaman">
          {(['Publik', 'Donatur', 'Admin'] as Group[]).map((g) => <optgroup key={g} label={g}>{pages.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</optgroup>)}
        </select>
        <div className="flex rounded-lg bg-muted p-0.5">
          {states.map((s) => <button key={s} onClick={() => set({ state: s })} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', state === s ? 'bg-surface shadow-sm' : 'text-ink-faint')}>{stateLabel[s]}</button>)}
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {widths.map(({ w: ww, label, icon: Icon }) => <button key={ww} title={label} aria-label={label} onClick={() => set({ w: ww })} className={cn('rounded-md px-2 py-1', width === ww ? 'bg-surface shadow-sm' : 'text-ink-faint')}><Icon className="h-4 w-4" /></button>)}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button disabled={idx <= 0} onClick={() => set({ id: pages[idx - 1].id })} className="rounded-lg px-2 py-1.5 hover:bg-muted disabled:opacity-40">‹ Seb.</button>
          <span className="text-xs text-ink-faint">{idx + 1}/{pages.length}</span>
          <button disabled={idx >= pages.length - 1} onClick={() => set({ id: pages[idx + 1].id })} className="rounded-lg px-2 py-1.5 hover:bg-muted disabled:opacity-40">Ber. ›</button>
          <a href={`#/p/${page.id}?state=${state}`} className="rounded-lg p-1.5 hover:bg-muted" title="Buka halaman penuh"><ExternalLink className="h-4 w-4" /></a>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <iframe
          key={`${page.id}-${state}`}
          title={page.title}
          src={`${getFrameBase()}#/p/${page.id}?state=${state}&frame=1`}
          className="mx-auto block h-full rounded-xl border border-border bg-white shadow-lift"
          style={{ width: width === 'full' ? '100%' : `${width}px`, maxWidth: '100%' }}
        />
      </div>
    </div>
  );
}

function Index() {
  const groups: Group[] = ['Publik', 'Donatur', 'Admin'];
  return (
    <div className="min-h-screen bg-bg">
      <header className="relative overflow-hidden bg-primary-ink text-white">
        <div className="pattern-islamic absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 py-10">
          <Logo light />
          <h1 className="mt-6 font-display text-3xl font-bold md:text-4xl">Mockup UI — Phase 1</h1>
          <p className="mt-2 max-w-2xl text-white/75">{pages.length} layar untuk review. Data contoh fiktif; tidak terhubung ke database atau payment gateway. Gunakan toolbar penampil untuk berganti state (normal/loading/empty/error) dan ukuran layar.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs"><Badge tone="gold" className="bg-white/10 text-gold-soft">Nama kerja: Tebar Kebaikan</Badge><Badge className="bg-white/10 text-white">Light theme</Badge><Badge className="bg-white/10 text-white">Mobile-first</Badge></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {groups.map((g) => (
          <section key={g} className="mb-10">
            <h2 className="text-lg font-bold">{g} <span className="font-normal text-ink-faint">· {pages.filter((p) => p.group === g).length} layar</span></h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pages.filter((p) => p.group === g).map((p) => (
                <a key={p.id} href={`#/v/${p.id}`} className="group rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold group-hover:text-primary">{p.title}</p>
                    {p.device === 'mobile' ? <Smartphone className="h-4 w-4 shrink-0 text-ink-faint" /> : <Laptop className="h-4 w-4 shrink-0 text-ink-faint" />}
                  </div>
                  <p className="mt-1 text-sm text-ink-faint">{p.note}</p>
                  <p className="mt-3 text-xs text-ink-faint">State: {p.states}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (route.mode === 'v') return <Viewer id={route.id} state={route.state} w={route.w} />;
  if (route.mode === 'p') {
    const page = pages.find((p) => p.id === route.id);
    if (!page) return <Index />;
    const { Component } = page;
    return (
      <MockStateContext.Provider value={route.state}>
        <Component />
        {!route.frame && (
          <a href={`#/v/${page.id}?state=${route.state}`} className="fixed right-3 top-20 z-[60] rounded-full bg-ink/80 px-3 py-1.5 text-xs font-medium text-white shadow-lift backdrop-blur">⧉ Penampil</a>
        )}
      </MockStateContext.Provider>
    );
  }
  return <Index />;
}
