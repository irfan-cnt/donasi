"use client";

import { inject } from "@vercel/analytics";
import { useEffect } from "react";
import { sanitizeAnalyticsUrl } from "@/lib/analytics";

/**
 * Vercel Web Analytics (P30). Dirender HANYA bila `process.env.VERCEL` (lihat layout publik,
 * checkout, halaman berhasil) — di luar Vercel/test tidak ada skrip & `track()` no-op.
 * Skrip `/_vercel/insights/script.js` dan endpoint `/_vercel/insights/*` same-origin → cocok
 * CSP `script-src 'self'` / `connect-src 'self'`. Tanpa cookie. URL dibersihkan dari query,
 * hash, dan kode transaksi sebelum dikirim. Taruh SEBELUM konten halaman agar antrean
 * `window.va` sudah ada saat efek komponen anak memanggil `track()`.
 */
export function WebAnalytics() {
  useEffect(() => {
    inject({
      mode: "production",
      framework: "next",
      beforeSend: (event) => {
        const url = sanitizeAnalyticsUrl(event.url);
        return url ? { ...event, url } : null;
      },
    });
  }, []);
  return null;
}
