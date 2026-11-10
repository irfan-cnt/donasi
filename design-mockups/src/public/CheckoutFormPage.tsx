import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Lock } from 'lucide-react';
import { campaigns } from '@/data/sample';
import { cn, formatThousands, rupiah, sanitizeAmountInput } from '@/lib/utils';
import { go, useMockState } from '@/lib/mock-state';
import { FlowLayout } from '@/components/public/layout';
import { categoryOf } from '@/components/public/campaign';
import { Alert, Button, Card, Checkbox, FieldError, Input, Label, Switch, Textarea } from '@/components/ui/primitives';
import { ImagePh } from '@/components/ui/shared';

export default function CheckoutFormPage({ variant = 'open', loggedIn = false }: { variant?: 'open' | 'fixed'; loggedIn?: boolean }) {
  const state = useMockState();
  const c = variant === 'open' ? campaigns[0] : campaigns[1];
  const [digits, setDigits] = useState(variant === 'open' ? '100000' : '');
  const [pkg, setPkg] = useState<string>(variant === 'fixed' ? 'p3' : '');
  const [name, setName] = useState(loggedIn ? 'Ahmad Fauzi' : '');
  const [email, setEmail] = useState(loggedIn ? 'ahmad.fauzi@example.com' : '');
  const [phone, setPhone] = useState(loggedIn ? '0812 3450 0011' : '');
  const [anon, setAnon] = useState(false);
  const [wa, setWa] = useState(true);
  const [prayer, setPrayer] = useState('');
  const [touched, setTouched] = useState(false);

  const amount = variant === 'open' ? Number(digits || 0) : c.packages.find((p) => p.id === pkg)?.amount ?? 0;
  const max = c.max ?? 1_000_000_000;
  const amountError = variant === 'open'
    ? (!digits ? 'Masukkan nominal donasi' : amount < c.min ? `Minimal donasi ${rupiah(c.min)}` : amount > max ? `Maksimal donasi ${rupiah(max)} per transaksi` : '')
    : (!pkg ? 'Pilih salah satu paket' : '');
  const nameError = !anon && !name.trim() ? 'Nama wajib diisi, atau aktifkan opsi Hamba Allah' : '';
  const emailError = !/^\S+@\S+\.\S+$/.test(email) ? 'Masukkan email yang valid untuk menerima kuitansi' : '';
  const valid = !amountError && !nameError && !emailError;
  const submitting = state === 'loading';

  const chips = useMemo(() => c.suggested, [c]);

  return (
    <FlowLayout
      title="Donasi"
      back="campaign-detail"
      step={1}
      footer={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-faint">Total donasi</p>
            <p className="tabular truncate text-lg font-bold text-primary-ink">{amount ? rupiah(amount) : 'Rp0'}</p>
          </div>
          <Button size="lg" className="shrink-0" disabled={submitting} onClick={() => { setTouched(true); if (valid) go('select-payment'); }}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Memproses…</> : 'Pilih Pembayaran'}
          </Button>
        </div>
      }
    >
      {/* Ringkasan campaign */}
      <div className="flex gap-3">
        <ImagePh hue={c.hue} icon={categoryOf(c.category).icon} className="h-16 w-20 shrink-0" label={c.title} />
        <div><p className="text-xs text-ink-faint">Kamu akan berdonasi untuk</p><p className="line-clamp-2 text-sm font-semibold leading-snug">{c.title}</p></div>
      </div>

      {state === 'error' && <Alert className="mt-4" tone="danger" title="Donasi belum dapat diproses">Program ini sedang tidak menerima donasi atau terjadi gangguan. Kode: REQ-91C2. Silakan coba lagi.</Alert>}

      {/* Nominal */}
      <Card className="mt-5 p-4">
        {variant === 'open' ? (
          <>
            <h2 className="font-semibold">Pilih nominal</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {chips.map((v) => (
                <button key={v} onClick={() => setDigits(String(v))} className={cn('tabular rounded-xl border px-2 py-3 text-sm font-semibold transition', amount === v ? 'border-primary bg-primary-soft text-primary-ink ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                  {rupiah(v)}
                </button>
              ))}
            </div>
            <Label htmlFor="amount" className="mt-4">Atau masukkan nominal lain</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-faint">Rp</span>
              <Input id="amount" inputMode="numeric" autoComplete="off" maxLength={17} className="tabular pl-10 text-right text-lg font-bold" value={formatThousands(digits)} onChange={(e) => setDigits(sanitizeAmountInput(e.target.value))} invalid={touched && !!amountError} aria-describedby="amount-hint" />
            </div>
            <p id="amount-hint" className="mt-1.5 text-xs text-ink-faint">Minimal {rupiah(c.min)} · maksimal {rupiah(max)}</p>
            {(touched || (digits && amountError)) && <FieldError>{amountError}</FieldError>}
          </>
        ) : (
          <>
            <h2 className="font-semibold">Pilih paket donasi</h2>
            <p className="text-xs text-ink-faint">Nominal paket ditetapkan oleh pengelola program</p>
            <div className="mt-3 space-y-2" role="radiogroup">
              {c.packages.filter((p) => p.active).map((p) => (
                <button key={p.id} role="radio" aria-checked={pkg === p.id} onClick={() => setPkg(p.id)} className={cn('flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition', pkg === p.id ? 'border-primary bg-primary-soft/60 ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', pkg === p.id ? 'border-primary bg-primary' : 'border-border')}>{pkg === p.id && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.label}</span><span className="block text-xs text-ink-faint">{p.description}</span></span>
                  <span className="tabular shrink-0 font-bold text-primary-ink">{rupiah(p.amount)}</span>
                </button>
              ))}
            </div>
            {touched && <FieldError>{amountError}</FieldError>}
          </>
        )}
      </Card>

      {/* Data donatur */}
      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Data donatur</h2>
          {loggedIn ? <span className="flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-4 w-4" />Masuk dengan Google</span> : <button onClick={() => go('donor-login')} className="text-xs font-semibold text-primary">Masuk dengan Google</button>}
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="name">Nama lengkap</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama sesuai kuitansi" autoComplete="name" disabled={anon && !name} invalid={touched && !!nameError} />
            {touched && <FieldError>{nameError}</FieldError>}
          </div>
          <Switch checked={anon} onChange={setAnon} label="Sembunyikan nama saya" description="Namamu tampil sebagai “Hamba Allah” di halaman program" />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" readOnly={loggedIn} invalid={touched && !!emailError} />
            {touched ? <FieldError>{emailError}</FieldError> : <p className="mt-1.5 text-xs text-ink-faint">Kuitansi & status donasi dikirim ke email ini</p>}
          </div>
          <div>
            <Label htmlFor="phone" optional>No. WhatsApp</Label>
            <Input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, '').slice(0, 17))} placeholder="08xx xxxx xxxx" autoComplete="tel" />
          </div>
          {phone && <Checkbox checked={wa} onChange={setWa}>Kirim status donasi lewat WhatsApp ke nomor ini</Checkbox>}
          <div>
            <Label htmlFor="prayer" optional>Doa atau pesan</Label>
            <Textarea id="prayer" rows={3} maxLength={280} value={prayer} onChange={(e) => setPrayer(e.target.value)} placeholder="Tuliskan doa terbaikmu…" />
            <p className="mt-1 text-right text-xs text-ink-faint">{prayer.length}/280</p>
          </div>
        </div>
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs text-ink-faint"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Dengan melanjutkan, kamu menyetujui Syarat & Ketentuan dan Kebijakan Privasi. Datamu tidak akan dibagikan ke pihak lain.</p>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
    </FlowLayout>
  );
}
