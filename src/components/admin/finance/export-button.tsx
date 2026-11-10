"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Tombol ekspor CSV (P22). Filter aktif dikirim apa adanya; server memvalidasi ulang (Zod) dan
// menentukan mode: stream langsung (≤ 10.000 baris) atau antre + tautan bertanda tangan 1 jam.
export function ExportButton({ kind, filters, label = "Ekspor CSV" }: { kind: "transactions" | "donors"; filters: Record<string, string | undefined>; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [job, setJob] = useState<{ url: string; status: "processing" | "ready" | "failed" } | null>(null);

  useEffect(() => {
    if (!job || job.status !== "processing") return;
    const t = setInterval(async () => {
      const r = await fetch(`${job.url}&cek=1`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const { status } = (await r.json()) as { status: "processing" | "ready" | "failed" };
      if (status !== "processing") setJob({ ...job, status });
    }, 4000);
    return () => clearInterval(t);
  }, [job]);

  async function run() {
    setBusy(true);
    setMsg(null);
    setJob(null);
    try {
      const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await fetch("/api/admin/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, filters: clean }) });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("text/csv")) {
        const blob = await res.blob();
        const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "ekspor.csv";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
        setMsg(`${Number(res.headers.get("x-export-rows") ?? 0).toLocaleString("id-ID")} baris diekspor.`);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string; downloadUrl?: string; rows?: number };
      if (res.status === 202 && body.downloadUrl) {
        setJob({ url: body.downloadUrl, status: "processing" });
        setMsg(`${(body.rows ?? 0).toLocaleString("id-ID")} baris sedang diproses. Tautan unduh berlaku 1 jam.`);
      } else setMsg(body.error ?? "Ekspor gagal. Silakan coba lagi.");
    } catch {
      setMsg("Ekspor gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="button" variant="outline" size="lg" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
        {label}
      </Button>
      <p className="text-xs text-ink-faint" role="status" aria-live="polite">
        {msg}
        {job?.status === "ready" ? (
          <>
            {" "}
            <a href={job.url} className="font-semibold text-primary underline">
              Unduh berkas
            </a>
          </>
        ) : null}
        {job?.status === "failed" ? " Ekspor gagal diproses." : null}
      </p>
    </div>
  );
}
