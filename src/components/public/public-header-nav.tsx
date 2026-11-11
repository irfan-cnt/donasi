"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/shared/logo";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { lpButton } from "./landing-ui";

// Navigasi header publik (desain beranda Nov 2026): tautan ke section beranda, penanda section
// aktif, garis progres gulir (hanya di beranda), dan menu laci di bawah 1181 px.
const NAV = [
  { id: "beranda", label: "Beranda", href: "/" },
  { id: "program", label: "Program Donasi", href: "/#program" },
  { id: "tentang", label: "Tentang Kami", href: "/#tentang" },
  { id: "transparansi", label: "Transparansi", href: "/#transparansi" },
  { id: "faq", label: "FAQ", href: "/#faq" },
] as const;

type NavId = (typeof NAV)[number]["id"];

function activeForPath(pathname: string): NavId | null {
  if (pathname === "/") return "beranda";
  if (pathname.startsWith("/campaign")) return "program";
  if (pathname === "/tentang") return "tentang";
  return null;
}

/** Section aktif di beranda + status gulir header; di halaman lain mengikuti path. */
function useHeaderScroll(progressRef: React.RefObject<HTMLDivElement | null>) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [spy, setSpy] = useState<NavId>("beranda");

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      header?.toggleAttribute("data-scrolled", y > 8);
      if (!isHome) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        progressRef.current.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
      }
      // Section aktif = section bernav terakhir (urutan dokumen) yang puncaknya sudah lewat header.
      let current: NavId = "beranda";
      let best = -Infinity;
      for (const { id } of NAV) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= 120 && top > best) {
          best = top;
          current = id;
        }
      }
      setSpy(current);
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
  }, [isHome, progressRef]);

  return { isHome, active: isHome ? spy : activeForPath(pathname) };
}

export function PublicHeaderNav({ account }: { account: ReactNode }) {
  const progressRef = useRef<HTMLDivElement>(null);
  const { isHome, active } = useHeaderScroll(progressRef);
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="mx-auto hidden gap-0.5 min-[1181px]:flex" aria-label="Navigasi utama">
        {NAV.map((item) => {
          const on = active === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={on ? (isHome ? "location" : "page") : undefined}
              className={cn(
                "relative rounded-full px-3.5 py-2.5 text-[14.5px] font-semibold transition-colors hover:bg-[#EEF4EF] hover:text-primary",
                on
                  ? "text-primary after:absolute after:bottom-[3px] after:left-1/2 after:-ml-[9px] after:h-[3px] after:w-[18px] after:rounded-[3px] after:bg-brand-orange after:content-['']"
                  : "text-ink-soft",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Buka menu"
          className="order-last inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#DCE3DD] bg-white text-ink transition-colors hover:border-primary hover:bg-[#F4F8F5] min-[1181px]:hidden"
        >
          <Menu className="size-[22px]" aria-hidden />
        </SheetTrigger>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="lp w-[min(360px,88vw)] gap-1 overflow-y-auto bg-white text-ink px-[18px] pt-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))] text-base data-[side=right]:w-[min(360px,88vw)] data-[side=right]:sm:max-w-none"
        >
          <div className="mb-2 flex items-center justify-between border-b border-[#EEF1ED] pb-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Logo size="sm" />
            <SheetClose
              aria-label="Tutup menu"
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-[#DCE3DD] bg-white text-ink transition-colors hover:border-primary hover:bg-[#F4F8F5]"
            >
              <X className="size-5" aria-hidden />
            </SheetClose>
          </div>
          <nav aria-label="Menu seluler" className="flex flex-col gap-1">
            {NAV.map((item) => {
              const on = active === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={on ? (isHome ? "location" : "page") : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-[52px] items-center justify-between rounded-xl px-3.5 text-[17px] font-bold transition-colors hover:bg-[#F4F8F5] hover:text-primary",
                    on ? "bg-[#EEF4EF] text-primary" : "text-ink",
                  )}
                >
                  {item.label}
                  <ChevronRight className="size-[18px]" aria-hidden />
                </Link>
              );
            })}
          </nav>
          {/* Klik tautan di kaki laci (donasi/akun) ikut menutup laci. */}
          <div className="mt-auto grid gap-2.5 pt-5" onClick={() => setOpen(false)}>
            <Link href="/#program" className={lpButton("orange", "md", "w-full")}>
              Donasi Sekarang
            </Link>
            {account}
          </div>
        </SheetContent>
      </Sheet>

      {isHome ? (
        <div
          ref={progressRef}
          aria-hidden
          className="absolute -bottom-px left-0 h-0.5 w-0 bg-brand-orange"
        />
      ) : null}
    </>
  );
}
