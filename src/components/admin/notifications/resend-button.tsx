"use client";

import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FieldError, FieldLabel, fieldClass } from "@/components/admin/form-bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resendNotificationAction } from "@/server/actions/admin-notification-actions";

// Kirim ulang (F-21). Event finansial yang sudah terkirim → server meminta "kirim ulang paksa":
// panel konfirmasi khusus dengan alasan wajib + centang pernyataan (tercatat di audit log).
export function ResendButton({ logId, canForce }: { logId: string; canForce: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [forceOpen, setForceOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [reasonError, setReasonError] = useState<string | undefined>();

  const submit = (force: boolean) =>
    start(async () => {
      setMsg(null);
      const r = await resendNotificationAction({ logId, force, reason: force ? reason : "" });
      if (r.ok) {
        setForceOpen(false);
        setReason("");
        setAck(false);
        setMsg({ ok: true, text: r.message });
        router.refresh();
        return;
      }
      setReasonError(r.fieldErrors?.reason);
      setMsg({ ok: false, text: r.error });
      if (r.needsForce && canForce) setForceOpen(true);
    });

  return (
    <div className="mt-4 space-y-3" data-testid="resend">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => submit(false)}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
          Kirim ulang
        </Button>
        {canForce && !forceOpen ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setForceOpen(true)}>
            Kirim ulang paksa…
          </Button>
        ) : null}
      </div>
      <p className={cn("text-xs", msg?.ok === false ? "text-danger" : "text-ink-soft")} role="status" aria-live="polite">
        {msg?.text}
      </p>
      {forceOpen ? (
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-3" role="group" aria-labelledby={`force-${logId}`}>
          <p id={`force-${logId}`} className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <AlertTriangle className="size-4" aria-hidden />
            Kirim ulang paksa
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Donatur dapat menerima pesan yang sama lebih dari sekali. Persetujuan WhatsApp, flag pengiriman, dan kuota tetap berlaku. Tindakan ini dicatat di audit log.
          </p>
          <div className="mt-3">
            <FieldLabel htmlFor={`reason-${logId}`}>Alasan</FieldLabel>
            <textarea
              id={`reason-${logId}`}
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={!!reasonError}
              placeholder="Mis. donatur melapor email tidak masuk (tiket #123)"
              className={cn(fieldClass, "h-auto py-2")}
            />
            <FieldError>{reasonError}</FieldError>
          </div>
          <label className="mt-2 flex items-start gap-2 text-xs text-ink">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
            Saya memahami notifikasi ini akan dikirim lagi ke donatur.
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="destructive" disabled={pending || !ack || reason.trim().length < 10} onClick={() => submit(true)}>
              Konfirmasi kirim ulang paksa
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setForceOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
