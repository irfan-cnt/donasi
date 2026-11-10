"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestAccountDeletionAction, type DeletionFormState } from "@/server/actions/donor-actions";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeletionFormState, FormData>(requestAccountDeletionAction, {});
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-danger/30 bg-surface p-5" aria-labelledby="hapus-akun">
      <h2 id="hapus-akun" className="text-sm font-semibold text-danger">
        Hapus akun
      </h2>
      <p className="mt-1 text-xs text-ink-faint">
        Data pribadimu (nama, email, nomor WhatsApp) akan dianonimkan dan kamu otomatis keluar. Catatan transaksi
        (kode, nominal, status, kuitansi) tetap disimpan untuk keperluan audit keuangan lembaga. Tindakan ini tidak
        dapat dibatalkan.
      </p>
      {!open ? (
        <Button type="button" variant="outline" size="sm" className="mt-3 text-danger" onClick={() => setOpen(true)}>
          Ajukan penghapusan akun
        </Button>
      ) : (
        <form action={action} className="mt-4 space-y-3">
          <label htmlFor="confirm-delete" className="block text-sm text-ink">
            Ketik <strong>HAPUS</strong> untuk konfirmasi
          </label>
          <Input id="confirm-delete" name="confirm" autoComplete="off" maxLength={10} className="max-w-xs" aria-invalid={!!state.error} />
          {state.error && (
            <p className="text-xs text-danger" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" size="sm" disabled={pending}>
              {pending ? "Memproses…" : "Hapus akun saya"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Batal
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
