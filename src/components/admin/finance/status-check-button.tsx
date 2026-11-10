"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { checkTransactionStatusAction } from "@/server/actions/admin-finance-actions";

/** "Cek status ke Midtrans": status hanya berubah dari jawaban provider (BR-18). */
export function StatusCheckButton({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await checkTransactionStatusAction(transactionId);
            setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
        Cek status ke Midtrans
      </Button>
      <p className={msg?.ok === false ? "text-xs text-danger" : "text-xs text-ink-faint"} role="status" aria-live="polite">
        {msg?.text}
      </p>
    </div>
  );
}
