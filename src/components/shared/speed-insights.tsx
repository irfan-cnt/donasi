"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";

/**
 * Vercel Speed Insights (RUM, P24/NFR-01–03). Hanya dipasang di layout publik & checkout,
 * tidak di /admin, /akun, /transaksi. Query string & hash selalu dibuang sebelum dikirim
 * (token pembayaran `?t=`/`?trx=` tidak pernah keluar). Skrip & endpoint same-origin
 * (/_vercel/speed-insights/*) → cocok dengan CSP `'self'`. Suspense: useSearchParams di dalam
 * komponen paket tidak boleh membuat shell dinamis (cacheComponents).
 */
export function PublicSpeedInsights() {
  return (
    <Suspense fallback={null}>
      <SpeedInsights
        beforeSend={(event) => {
          const url = new URL(event.url);
          return { ...event, url: `${url.origin}${url.pathname}` };
        }}
      />
    </Suspense>
  );
}
