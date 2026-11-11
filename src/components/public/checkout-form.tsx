"use client";

import { CheckCircle2, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  amountError,
  formatAmountDigits,
  normalizeIndonesianPhone,
  PRAYER_MAX,
  sanitizeAmountInput,
  type DonationFieldErrors,
} from "@/lib/validation/donation-input";
import { createDonationAction, type DonationFormState } from "@/server/actions/donations";

export interface CheckoutOption {
  id: string;
  label: string | null;
  /** Nominal rupiah sebagai string digit (bigint aman lintas server→client). */
  amount: string;
  description: string | null;
}

export interface CheckoutPrefill {
  name: string;
  email: string;
  phone: string;
  /** Default checkbox dari profil (F-15). Persetujuan WA tetap per transaksi (P17). */
  whatsappOptIn: boolean;
  defaultAnonymous: boolean;
}

const rupiahFmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const rp = (digits: string) => (digits ? rupiahFmt.format(BigInt(digits)).replace(/ /g, " ") : "Rp 0");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT = "h-11 text-base";

function FieldError({ id, children }: { id?: string; children?: string | null }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-danger" role="alert">
      {children}
    </p>
  );
}

function Label({ htmlFor, children, optional }: { htmlFor: string; children: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
      {children}
      {optional && <span className="ml-1 font-normal text-ink-faint">(opsional)</span>}
    </label>
  );
}

export function CheckoutForm({
  slug,
  amountType,
  min,
  max,
  options,
  prefill,
  loginHref,
}: {
  slug: string;
  amountType: "open" | "fixed";
  min: string;
  max: string;
  options: CheckoutOption[];
  prefill: CheckoutPrefill | null;
  loginHref: string;
}) {
  const [state, action, pending] = useActionState<DonationFormState, FormData>(createDonationAction, {});
  const [digits, setDigits] = useState("");
  const [optionId, setOptionId] = useState("");
  const [name, setName] = useState(prefill?.name ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [anon, setAnon] = useState(prefill?.defaultAnonymous ?? false);
  const [wa, setWa] = useState(prefill ? prefill.whatsappOptIn : true);
  const [prayer, setPrayer] = useState("");
  const [touched, setTouched] = useState(false);

  const bounds = { min: BigInt(min), max: BigInt(max) };
  const selected = options.find((o) => o.id === optionId);
  const totalDigits = amountType === "open" ? digits : (selected?.amount ?? "");

  const client: DonationFieldErrors = {
    amount: amountType === "open" ? (amountError(digits, bounds) ?? undefined) : undefined,
    optionId: amountType === "fixed" && !selected ? "Pilih salah satu paket." : undefined,
    name: !anon && !name.trim() ? "Nama wajib diisi, atau aktifkan opsi Hamba Allah." : undefined,
    email: !EMAIL_RE.test(email.trim()) ? "Masukkan email yang valid untuk menerima kuitansi." : undefined,
    phone: phone.trim() && !normalizeIndonesianPhone(phone) ? "Nomor WhatsApp tidak valid (contoh: 0812 3456 7890)." : undefined,
  };
  const server = state.fieldErrors ?? {};
  const err = (k: keyof DonationFieldErrors) => (touched ? client[k] : undefined) ?? server[k];
  const hasClientError = Object.values(client).some(Boolean);
  // AC-04.1: nominal open di luar rentang → pesan inline + tombol nonaktif.
  const amountBlocked = amountType === "open" && !!digits && !!client.amount;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    setTouched(true);
    if (hasClientError) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="anonymous" value={anon ? "on" : ""} />
      <input type="hidden" name="waConsent" value={wa && phone.trim() ? "on" : ""} />
      {amountType === "open" ? (
        <input type="hidden" name="amount" value={digits} />
      ) : (
        <input type="hidden" name="optionId" value={optionId} />
      )}

      {state.error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Donasi belum dapat diproses</AlertTitle>
          <AlertDescription>
            {state.error}
            {state.reference && <span className="mt-1 block text-xs">Kode referensi: {state.reference}</span>}
          </AlertDescription>
        </Alert>
      )}

      <section className="mt-5 rounded-xl border border-border bg-surface p-4">
        {amountType === "open" ? (
          <>
            <h2 className="font-semibold">Pilih nominal</h2>
            {options.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setDigits(o.amount)}
                    aria-pressed={digits === o.amount}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-sm font-semibold tabular-nums transition",
                      digits === o.amount
                        ? "border-primary bg-primary-soft text-primary-ink ring-1 ring-primary"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    {rp(o.amount)}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Label htmlFor="amount-input">{options.length > 0 ? "Atau masukkan nominal lain" : "Nominal donasi"}</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-ink-faint">
                  Rp
                </span>
                <Input
                  id="amount-input"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={17}
                  className={cn(INPUT, "pl-10 text-right text-lg font-bold tabular-nums")}
                  value={formatAmountDigits(digits)}
                  onChange={(e) => setDigits(sanitizeAmountInput(e.target.value))}
                  aria-invalid={!!err("amount") || amountBlocked || undefined}
                  aria-describedby="amount-hint amount-error"
                />
              </div>
              <p id="amount-hint" className="mt-1.5 text-xs text-ink-faint">
                Minimal {rp(min)} · maksimal {rp(max)}
              </p>
              <FieldError id="amount-error">{err("amount") ?? (amountBlocked ? client.amount : undefined)}</FieldError>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-semibold">Pilih paket donasi</h2>
            <p className="text-xs text-ink-faint">Nominal paket ditetapkan oleh pengelola program</p>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Paket donasi">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={optionId === o.id}
                  onClick={() => setOptionId(o.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition",
                    optionId === o.id
                      ? "border-primary bg-primary-soft/60 ring-1 ring-primary"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      optionId === o.id ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {optionId === o.id && <span className="size-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{o.label ?? rp(o.amount)}</span>
                    {o.description && <span className="block text-xs text-ink-faint">{o.description}</span>}
                  </span>
                  <span className="shrink-0 font-bold text-primary-ink tabular-nums">{rp(o.amount)}</span>
                </button>
              ))}
            </div>
            <FieldError>{err("optionId")}</FieldError>
          </>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Data donatur</h2>
          {prefill ? (
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              Masuk dengan Google
            </span>
          ) : (
            <Link href={loginHref} prefetch={false} className="text-xs font-semibold text-primary">
              Masuk dengan Google
            </Link>
          )}
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="name">Nama lengkap</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Nama sesuai kuitansi"
              autoComplete="name"
              className={INPUT}
              aria-invalid={!!err("name") || undefined}
            />
            <FieldError>{err("name")}</FieldError>
          </div>
          <label className="flex items-start gap-3">
            <Switch checked={anon} onCheckedChange={setAnon} className="mt-0.5" aria-label="Sembunyikan nama saya" />
            <span>
              <span className="block text-sm font-medium">Sembunyikan nama saya</span>
              <span className="block text-xs text-ink-faint">Namamu tampil sebagai “Hamba Allah” di halaman program</span>
            </span>
          </label>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              placeholder="nama@email.com"
              autoComplete="email"
              readOnly={!!prefill}
              className={cn(INPUT, prefill && "bg-muted")}
              aria-invalid={!!err("email") || undefined}
            />
            {err("email") ? (
              <FieldError>{err("email")}</FieldError>
            ) : (
              <p className="mt-1.5 text-xs text-ink-faint">Kuitansi & status donasi dikirim ke email ini</p>
            )}
          </div>
          <div>
            <Label htmlFor="phone" optional>
              No. WhatsApp
            </Label>
            <Input
              id="phone"
              name="phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 17))}
              placeholder="08xx xxxx xxxx"
              autoComplete="tel"
              className={INPUT}
              aria-invalid={!!err("phone") || undefined}
            />
            <FieldError>{err("phone")}</FieldError>
          </div>
          {phone.trim() && (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={wa} onCheckedChange={setWa} className="mt-0.5" aria-label="Persetujuan WhatsApp" />
              <span>Kirim status donasi lewat WhatsApp ke nomor ini</span>
            </label>
          )}
          <div>
            <Label htmlFor="prayer" optional>
              Doa atau pesan
            </Label>
            <Textarea
              id="prayer"
              name="prayer"
              rows={3}
              maxLength={PRAYER_MAX}
              value={prayer}
              onChange={(e) => setPrayer(e.target.value)}
              placeholder="Tuliskan doa terbaikmu…"
            />
            <p className="mt-1 text-right text-xs text-ink-faint">
              {prayer.length}/{PRAYER_MAX}
            </p>
            <FieldError>{server.prayer}</FieldError>
          </div>
        </div>
      </section>

      <p className="mt-4 flex items-start gap-2 text-xs text-ink-faint">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Dengan melanjutkan, kamu menyetujui Syarat & Ketentuan dan Kebijakan Privasi. Datamu tidak akan dibagikan ke pihak lain.
      </p>
      {/* Honeypot: tersembunyi dari manusia & pembaca layar. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-faint">Total donasi</p>
            <p className="truncate text-lg font-bold text-primary-ink tabular-nums" data-testid="checkout-total">
              {rp(totalDigits)}
            </p>
          </div>
          <Button type="submit" size="lg" className="h-11 shrink-0 px-5 text-base" disabled={pending || amountBlocked}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Memproses…
              </>
            ) : (
              "Pilih Pembayaran"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
