"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Konten panjang dipotong dengan gradien; tetap ada di HTML (SEO) saat tertutup. */
export function ReadMore({ children, id }: { children: ReactNode; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div id={id} className={cn("relative mt-3", !open && "max-h-48 overflow-hidden")}>
        {children}
        {!open ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent" />
        ) : null}
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="mt-2 flex items-center gap-1 text-sm font-semibold text-primary"
      >
        {open ? "Tutup" : "Baca selengkapnya"}
        <ChevronDown className={cn("size-4 transition", open && "rotate-180")} aria-hidden />
      </button>
    </>
  );
}
