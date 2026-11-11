"use client";

import { useEffect, useRef } from "react";
import { LANDING_SOURCE_KEY, track } from "@/lib/analytics";

function takeSessionFlag(key: string): boolean {
  try {
    const v = sessionStorage.getItem(key);
    if (v) sessionStorage.removeItem(key);
    return Boolean(v);
  } catch {
    return false;
  }
}

/** `donation_start` sekali saat form donasi pertama kali dirender (P30). */
export function TrackDonationStart({ slug }: { slug: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("donation_start", {
      campaign_slug: slug,
      source: takeSessionFlag(LANDING_SOURCE_KEY) ? "landing" : "other",
    });
  }, [slug]);
  return null;
}

/**
 * `donation_paid_view` sekali per transaksi (AC-07.4). Penanda "sudah dikirim" disimpan di
 * sessionStorage browser saja; kode transaksi TIDAK pernah dikirim ke analytics.
 */
export function TrackPaidView({ code }: { code: string }) {
  useEffect(() => {
    const key = `tk:paid-view:${code}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // tanpa sessionStorage: tetap kirim (paling banyak sekali per muat halaman).
    }
    track("donation_paid_view");
  }, [code]);
  return null;
}
