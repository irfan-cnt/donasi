import { z } from "zod";
import { TRANSACTION_CODE_PATTERN } from "@/lib/transaction-code";

/**
 * Rentang dashboard admin (F-23). Murni & deterministik: `now` diberikan pemanggil.
 * Tanggal = hari kalender Asia/Jakarta (YYYY-MM-DD, inklusif); konversi ke timestamptz di SQL.
 */
export const DASHBOARD_PRESETS = ["7", "30", "90"] as const;
export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number];
export const DASHBOARD_MAX_DAYS = 366;

export interface DashboardRange {
  from: string;
  to: string;
  days: number;
  preset: DashboardPreset | "custom";
}

const DAY_MS = 86_400_000;
const jakartaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function jakartaToday(now: Date): string {
  return jakartaDay.format(now);
}

const dayNum = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const isoOf = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

const isoDate = z.iso.date();
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export const dashboardQuery = z.object({
  rentang: z.preprocess(one, z.enum(DASHBOARD_PRESETS).optional().catch(undefined)),
  dari: z.preprocess(one, isoDate.optional().catch(undefined)),
  sampai: z.preprocess(one, isoDate.optional().catch(undefined)),
});

/** searchParams → rentang valid. Nilai tidak valid diabaikan → default 30 hari. */
export function resolveDashboardRange(raw: Record<string, unknown>, now: Date): DashboardRange {
  const q = dashboardQuery.parse(raw);
  const today = dayNum(jakartaToday(now));
  if (!q.rentang && q.dari && q.sampai) {
    const from = dayNum(q.dari);
    const to = Math.min(dayNum(q.sampai), today);
    const days = to - from + 1;
    if (days >= 1 && days <= DASHBOARD_MAX_DAYS) {
      return { from: isoOf(from), to: isoOf(to), days, preset: "custom" };
    }
  }
  const preset = q.rentang ?? "30";
  const days = Number(preset);
  return { from: isoOf(today - days + 1), to: isoOf(today), days, preset };
}

/** Rentang pembanding (periode sebelumnya dengan panjang sama). */
export function previousRange(r: DashboardRange): { from: string; to: string } {
  const from = dayNum(r.from);
  return { from: isoOf(from - r.days), to: isoOf(from - 1) };
}

/** Pencarian global admin (topbar). */
export const adminSearchSchema = z.object({ q: z.string().trim().min(2).max(100) });

export type AdminSearchKind = "transaction" | "email" | "text";

export function classifyAdminSearch(q: string): AdminSearchKind {
  const up = q.toUpperCase();
  if (TRANSACTION_CODE_PATTERN.test(up) || /^TK-[0-9]{0,6}(-[0-9A-Z]{0,6})?$/.test(up)) return "transaction";
  if (q.includes("@")) return "email";
  return "text";
}
