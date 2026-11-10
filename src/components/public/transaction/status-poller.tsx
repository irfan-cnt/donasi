"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { POLL_INTERVAL_MS, POLL_MAX_MS } from "@/lib/payments/countdown";

declare global {
  interface Window {
    /** Hook KHUSUS e2e (dihormati hanya bila server mengizinkan, APP_ENV ≠ production). */
    __TK_POLL__?: { intervalMs?: number; maxMs?: number };
  }
}

const PAYABLE = new Set(["created", "pending"]);

/**
 * Polling GET /api/transactions/[code]/status tiap 5 s maks 10 menit (AC-08.1), lalu tombol
 * "Cek status". paid → halaman berhasil; status akhir lain → muat ulang data server (AC-08.2).
 * Hanya membaca status — tidak pernah mengubahnya.
 */
export function StatusPoller({
  code,
  token,
  allowTestHook = false,
}: {
  code: string;
  token: string;
  allowTestHook?: boolean;
}) {
  const router = useRouter();
  const [polling, setPolling] = useState(true);
  const [checking, setChecking] = useState(false);
  const [round, setRound] = useState(0);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const done = useRef(false);

  const check = useCallback(async (): Promise<"continue" | "stop"> => {
    const qs = new URLSearchParams({ t: token });
    const res = await fetch(`/api/transactions/${encodeURIComponent(code)}/status?${qs}`, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
    }).catch(() => null);
    setLastChecked(
      new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", timeStyle: "medium" }).format(new Date()),
    );
    if (!res) return "continue";
    if (res.status === 404) return "stop";
    if (!res.ok) return "continue";
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (body?.status === "paid") {
      done.current = true;
      router.replace(`/transaksi/${encodeURIComponent(code)}/berhasil?${qs}`);
      return "stop";
    }
    if (body?.status && !PAYABLE.has(body.status)) {
      done.current = true;
      router.refresh();
      return "stop";
    }
    return "continue";
  }, [code, token, router]);

  useEffect(() => {
    if (!polling) return;
    const hook = allowTestHook ? window.__TK_POLL__ : undefined;
    const interval = hook?.intervalMs ?? POLL_INTERVAL_MS;
    const max = hook?.maxMs ?? POLL_MAX_MS;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const loop = async () => {
      if (cancelled || done.current) return;
      if (Date.now() - started >= max) {
        setPolling(false);
        return;
      }
      const next = await check();
      if (cancelled) return;
      if (next === "stop") {
        setPolling(false);
        return;
      }
      timer = setTimeout(loop, interval);
    };
    timer = setTimeout(loop, interval);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [polling, round, check, allowTestHook]);

  async function manualCheck() {
    setChecking(true);
    const next = await check();
    setChecking(false);
    if (next === "continue") {
      setRound((r) => r + 1);
      setPolling(true);
    }
  }

  if (polling) {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-faint" role="status" data-testid="poll-status">
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
        Menunggu konfirmasi pembayaran otomatis…
        {lastChecked && <span className="sr-only"> Terakhir dicek {lastChecked} WIB.</span>}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3" role="status">
      <p className="text-xs text-ink-faint">
        Pengecekan otomatis berhenti{lastChecked ? ` (terakhir ${lastChecked} WIB)` : ""}.
      </p>
      <Button type="button" size="sm" onClick={manualCheck} disabled={checking}>
        {checking ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
        Cek status
      </Button>
    </div>
  );
}
