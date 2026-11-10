"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { remainingUntil } from "@/lib/payments/countdown";

/** Hitung mundur dari expires_at; saat habis → muat ulang data server (state kedaluwarsa). */
export function PaymentCountdown({ expiresAt, initialLabel }: { expiresAt: string; initialLabel: string }) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  useEffect(() => {
    let refreshed = false;
    const tick = () => {
      const r = remainingUntil(expiresAt, Date.now());
      setLabel(r.label);
      if (r.expired && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, router]);
  return (
    <span className="font-mono font-bold tabular-nums" data-testid="countdown" aria-live="off">
      {label}
    </span>
  );
}
