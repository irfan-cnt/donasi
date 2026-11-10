"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface DailyChartPoint {
  label: string;
  /** Hanya untuk tinggi batang (visual); angka tampil memakai `amountText` dari server (bigint). */
  value: number;
  amountText: string;
  count: number;
}

const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

export function DailyDonationChart({ data }: { data: DailyChartPoint[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Grafik donasi harian (Rp)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={44}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)" }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as DailyChartPoint | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow">
                  <p className="font-semibold text-ink">{p.label}</p>
                  <p className="text-ink-soft tabular-nums">{p.amountText}</p>
                  <p className="text-ink-faint">{p.count} transaksi</p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
