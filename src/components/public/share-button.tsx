"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Web Share API bila tersedia; fallback salin tautan. Umpan balik inline (tanpa toast) agar
 * sonner tidak masuk bundle halaman publik (P24, NFR-04).
 */
export function ShareButton({
  title,
  className,
  iconOnly,
  variant = "outline",
}: {
  title: string;
  className?: string;
  iconOnly?: boolean;
  variant?: "outline" | "ghost";
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  function flash(next: "copied" | "error") {
    setStatus(next);
    setTimeout(() => setStatus("idle"), 2000);
  }
  async function share() {
    const url = window.location.href.split("?")[0]!;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      flash("error");
    }
  }
  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      onClick={share}
      aria-label={iconOnly ? "Bagikan" : undefined}
      className={cn("h-11", className)}
    >
      {status === "copied" ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
      {iconOnly ? null : status === "copied" ? "Tautan disalin" : status === "error" ? "Gagal membagikan" : "Bagikan"}
      <span aria-live="polite" className="sr-only">
        {status === "copied" ? "Tautan disalin" : status === "error" ? "Tautan tidak dapat dibagikan" : ""}
      </span>
    </Button>
  );
}
