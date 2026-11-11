"use client";

import { ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { lpButton } from "./landing-ui";

/**
 * Elemen mengambang beranda (desain Nov 2026): tombol kembali ke atas dan, di ponsel, bilah
 * ajakan donasi yang muncul selama halaman digulir. Murni navigasi dalam halaman.
 */
export function LandingFloating() {
  const [state, setState] = useState({ top: false, cta: false });

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? y / max : 0;
      const next = { top: y > 720, cta: progress > 0.05 && progress < 0.92 };
      setState((prev) => (prev.top === next.top && prev.cta === next.cta ? prev : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      {state.top ? (
        <button
          type="button"
          aria-label="Kembali ke atas"
          onClick={() => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
          }}
          className="fixed right-4 bottom-[92px] z-30 flex size-[46px] animate-lp-rise items-center justify-center rounded-2xl bg-primary text-white shadow-[0_16px_32px_-14px_rgba(6,68,38,.8)] transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-primary-hover motion-reduce:animate-none sm:right-6 sm:bottom-6 sm:size-[50px]"
        >
          <ArrowUp className="size-[22px]" aria-hidden />
        </button>
      ) : null}
      {state.cta ? (
        <div className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-30 flex animate-lp-rise items-center justify-between gap-3 rounded-[18px] border border-[#E1EAE3] bg-white py-2.5 pr-2.5 pl-4 shadow-[0_18px_40px_-16px_rgba(6,68,38,.55)] motion-reduce:animate-none sm:hidden">
          <div className="min-w-0">
            <strong className="block text-sm leading-[1.3]">Mari berbagi hari ini</strong>
            <span className="text-[12.5px] text-ink-faint">Pilih program yang ingin kamu bantu</span>
          </div>
          <Link href="/#program" className={lpButton("orange", "sm")}>
            Donasi Sekarang
          </Link>
        </div>
      ) : null}
    </>
  );
}
