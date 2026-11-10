"use client";

import { CalendarRange } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DashboardRange } from "@/lib/validation/admin-dashboard";

const PRESETS = [
  { value: "7", label: "7 hari" },
  { value: "30", label: "30 hari" },
  { value: "90", label: "90 hari" },
  { value: "custom", label: "Rentang khusus" },
] as const;

/** Filter rentang dashboard → URL (?rentang= atau ?dari=&sampai=). Validasi akhir di server (Zod). */
export function DashboardFilter({ range, today }: { range: DashboardRange; today: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<string>(range.preset);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="dashboard-filter">
      <label className="sr-only" htmlFor="dash-range">
        Rentang waktu
      </label>
      <select
        id="dash-range"
        value={mode}
        onChange={(e) => {
          setMode(e.target.value);
          if (e.target.value !== "custom") router.push(`/admin?rentang=${e.target.value}`);
        }}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-sm"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {mode === "custom" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(`/admin?dari=${from}&sampai=${to}`);
          }}
        >
          <label className="text-xs text-ink-faint">
            Dari
            <input
              type="date"
              required
              value={from}
              max={to || today}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-0.5 block h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink"
            />
          </label>
          <label className="text-xs text-ink-faint">
            Sampai
            <input
              type="date"
              required
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="mt-0.5 block h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            <CalendarRange className="size-4" aria-hidden />
            Terapkan
          </button>
        </form>
      ) : null}
    </div>
  );
}
