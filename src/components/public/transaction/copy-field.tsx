"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Nilai + tombol salin (nomor VA, kode bayar, nominal). */
export function CopyField({
  label,
  value,
  display,
  mono,
  testId,
}: {
  label: string;
  value: string;
  display?: string;
  mono?: boolean;
  testId?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} disalin`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin. Salin secara manual.");
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-ink-faint">{label}</p>
        <p
          className={mono ? "font-mono text-lg font-bold tracking-wide break-all" : "text-lg font-bold tabular-nums"}
          data-testid={testId}
        >
          {display ?? value}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Salin ${label}`}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Disalin" : "Salin"}
      </Button>
    </div>
  );
}
