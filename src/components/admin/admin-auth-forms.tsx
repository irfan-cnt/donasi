"use client";

import { Loader2, Lock } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FieldLabel } from "@/components/admin/auth-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changePasswordAction,
  confirmTotpAction,
  loginAdmin,
  type FormState,
} from "@/server/actions/admin-auth-actions";

const INPUT = "h-11 text-base";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="mt-6 h-12 w-full text-base" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

function ErrorAlert({ state, title }: { state: FormState; title: string }) {
  if (!state.error) return null;
  return (
    <Alert variant="destructive" className="mt-4">
      <AlertTitle>
        {state.error.startsWith("Akun dikunci") ? "Akun dikunci sementara" : title}
      </AlertTitle>
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function AdminLoginForm() {
  const [state, action] = useActionState(loginAdmin, {});
  return (
    <form action={action} noValidate>
      <ErrorAlert state={state} title="Gagal masuk" />
      <div className="mt-5 space-y-4">
        <div>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className={INPUT}
          />
        </div>
        <div>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={INPUT}
          />
        </div>
        <div>
          <FieldLabel htmlFor="totp">Kode autentikator (6 digit)</FieldLabel>
          <Input
            id="totp"
            name="totp"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            autoComplete="one-time-code"
            className={`${INPUT} tracking-[0.4em] tabular-nums`}
            aria-describedby="totp-hint"
          />
          <p id="totp-hint" className="mt-1 text-xs text-ink-faint">
            Kosongkan bila belum mengaktifkan autentikator (login pertama).
          </p>
        </div>
      </div>
      <SubmitButton label="Masuk" pendingLabel="Memverifikasi…" />
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {});
  return (
    <form action={action} noValidate>
      <ErrorAlert state={state} title="Gagal mengganti password" />
      <div className="mt-5 space-y-4">
        <div>
          <FieldLabel htmlFor="currentPassword">Password saat ini</FieldLabel>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={INPUT}
          />
        </div>
        <div>
          <FieldLabel htmlFor="newPassword">Password baru (min. 12 karakter)</FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className={INPUT}
          />
        </div>
        <div>
          <FieldLabel htmlFor="confirmPassword">Ulangi password baru</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className={INPUT}
          />
        </div>
      </div>
      <SubmitButton label="Simpan password" pendingLabel="Menyimpan…" />
    </form>
  );
}

export function TotpConfirmForm() {
  const [state, action] = useActionState(confirmTotpAction, {});
  return (
    <form action={action} noValidate>
      <ErrorAlert state={state} title="Gagal mengaktifkan" />
      <div className="mt-5">
        <FieldLabel htmlFor="code">Kode dari aplikasi (6 digit)</FieldLabel>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="123456"
          autoComplete="one-time-code"
          className={`${INPUT} tracking-[0.4em] tabular-nums`}
        />
      </div>
      <SubmitButton label="Aktifkan autentikator" pendingLabel="Memverifikasi…" />
    </form>
  );
}
