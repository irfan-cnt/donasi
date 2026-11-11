"use client";

import { useEffect } from "react";
import { LANDING_SOURCE_KEY, track } from "@/lib/analytics";

/**
 * Pelacak klik landing page (P30, LP-AC-15) lewat satu listener terdelegasi — tanpa mengubah
 * komponen kartu/tombol menjadi komponen klien. Markup server memberi atribut:
 *  - `data-track-cta="primary|secondary"` pada CTA hero → `landing_hero_cta_click`
 *  - `data-track-section="featured|urgent|list"` pada pembungkus kartu program →
 *    `landing_campaign_click` untuk tautan `/campaign/{slug}` di dalamnya.
 */
export function TrackClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      const link = el?.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const path = new URL(link.href, window.location.href).pathname;
      const cta = link.dataset.trackCta;
      if (cta === "primary" || cta === "secondary") {
        track("landing_hero_cta_click", { cta, target: path });
      } else {
        const section = link.closest<HTMLElement>("[data-track-section]")?.dataset.trackSection;
        const slug = /^\/campaign\/([^/]+)$/.exec(path)?.[1];
        if (!section || !slug) return;
        track("landing_campaign_click", { campaign_slug: slug, section });
      }
      try {
        sessionStorage.setItem(LANDING_SOURCE_KEY, "1");
      } catch {
        // sessionStorage bisa diblokir; atribusi sumber hanya hilang.
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
