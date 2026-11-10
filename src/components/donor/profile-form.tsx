"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateProfileAction, type ProfileFormState } from "@/server/actions/donor-actions";

export interface ProfileDefaults {
  name: string;
  email: string;
  phone: string;
  whatsappOptIn: boolean;
  defaultAnonymous: boolean;
}

function PrefRow({
  id,
  label,
  description,
  children,
}: {
  id: string;
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <p className="text-xs text-ink-faint">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfileAction, {});
  const [wa, setWa] = useState(defaults.whatsappOptIn);
  const [anon, setAnon] = useState(defaults.defaultAnonymous);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2" noValidate>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-ink">Data diri</h2>
        {state.ok && (
          <Alert className="mt-3" role="status">
            <CheckCircle2 aria-hidden />
            <AlertTitle>Profil tersimpan</AlertTitle>
          </Alert>
        )}
        {err.form && (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>Gagal menyimpan</AlertTitle>
            <AlertDescription>{err.form}</AlertDescription>
          </Alert>
        )}
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="pn" className="text-sm font-medium text-ink">
              Nama tampilan
            </label>
            <Input id="pn" name="name" defaultValue={defaults.name} maxLength={80} aria-invalid={!!err.name} className="mt-1.5" />
            {err.name && <p className="mt-1 text-xs text-danger">{err.name}</p>}
          </div>
          <div>
            <label htmlFor="pe" className="text-sm font-medium text-ink">
              Email (dari Google)
            </label>
            <Input id="pe" value={defaults.email} readOnly disabled className="mt-1.5 bg-muted text-ink-faint" />
          </div>
          <div>
            <label htmlFor="pw" className="text-sm font-medium text-ink">
              No. WhatsApp
            </label>
            <Input
              id="pw"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812 3456 7890"
              defaultValue={defaults.phone}
              maxLength={20}
              aria-invalid={!!err.phone}
              className="mt-1.5"
            />
            {err.phone && (
              <p className="mt-1 text-xs text-danger" data-testid="phone-error">
                {err.phone}
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-ink">Preferensi</h2>
        <div className="mt-4 space-y-5">
          <PrefRow id="pref-email" label="Email status & kuitansi" description="Wajib untuk transaksi — tidak bisa dimatikan">
            <Switch id="pref-email" checked disabled aria-label="Email status & kuitansi" />
          </PrefRow>
          <PrefRow
            id="pref-wa"
            label="Notifikasi WhatsApp"
            description="Default centang WhatsApp saat berdonasi. Pesan hanya dikirim untuk donasi yang kamu setujui."
          >
            <Switch id="pref-wa" name="whatsappOptIn" checked={wa} onCheckedChange={setWa} aria-label="Notifikasi WhatsApp" />
          </PrefRow>
          <PrefRow id="pref-anon" label="Selalu sembunyikan nama saya" description="Default “Hamba Allah” setiap berdonasi">
            <Switch id="pref-anon" name="defaultAnonymous" checked={anon} onCheckedChange={setAnon} aria-label="Selalu sembunyikan nama saya" />
          </PrefRow>
        </div>
        <Button type="submit" className="mt-6" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan perubahan"}
        </Button>
      </section>
    </form>
  );
}
