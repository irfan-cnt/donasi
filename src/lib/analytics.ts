import { track as vercelTrack } from "@vercel/analytics";

/**
 * Wrapper event analytics (P30, BUG-04/AC-07.4). Satu-satunya titik panggil `@vercel/analytics`.
 *
 * - No-op di server, di luar Vercel, dan di test: event hanya dikirim bila `<WebAnalytics />`
 *   sudah memasang antrean `window.va` (komponen itu hanya dirender saat `VERCEL` di-set).
 * - Tanpa PII/identitas transaksi: hanya nama event & properti yang ada di allowlist di bawah,
 *   nilainya string pendek (slug/path). Properti lain dibuang sebelum dikirim.
 * - Maks. 2 properti per event (batas paket Pro Vercel Web Analytics; lebih dari itu dibuang
 *   oleh Vercel). Bila paket tidak mendukung custom event, Vercel mengabaikannya — tidak ada
 *   error di halaman. Semua kegagalan ditelan (try/catch).
 */
export const ANALYTICS_EVENTS = {
  landing_hero_cta_click: ["cta", "target"],
  landing_campaign_click: ["campaign_slug", "section"],
  donation_start: ["campaign_slug", "source"],
  donation_paid_view: [],
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
type PropsOf<E extends AnalyticsEvent> = Partial<
  Record<(typeof ANALYTICS_EVENTS)[E][number], string>
>;

/** Nilai aman: slug/path/enum saja (huruf kecil, angka, `-`, `_`, `/`), maks. 120 karakter. */
const SAFE_VALUE = /^[a-z0-9_\-/]{1,120}$/;

export function sanitizeProps<E extends AnalyticsEvent>(
  event: E,
  props: PropsOf<E> = {},
): Record<string, string> {
  const allowed: readonly string[] = ANALYTICS_EVENTS[event];
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (allowed.includes(k) && typeof v === "string" && SAFE_VALUE.test(v)) out[k] = v;
  }
  return out;
}

export function track<E extends AnalyticsEvent>(event: E, props?: PropsOf<E>): void {
  try {
    if (typeof window === "undefined" || typeof window.va !== "function") return;
    if (!(event in ANALYTICS_EVENTS)) return;
    const clean = sanitizeProps(event, props);
    vercelTrack(event, Object.keys(clean).length ? clean : undefined);
  } catch {
    // Analytics tidak boleh mengganggu donasi.
  }
}

/**
 * URL yang dikirim Vercel Analytics (pageview & event): tanpa query/hash (token `?t=`) dan kode
 * transaksi di path diganti `[code]`.
 */
export function sanitizeAnalyticsUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname
      .replace(/^\/transaksi\/[^/]+/, "/transaksi/[code]")
      .replace(/^\/akun\/donasi\/[^/]+/, "/akun/donasi/[code]");
    return `${u.origin}${path}`;
  } catch {
    return "";
  }
}

/** Penanda sesi (sessionStorage, tanpa PII): donasi berasal dari landing page. */
export const LANDING_SOURCE_KEY = "tk:src:landing";
