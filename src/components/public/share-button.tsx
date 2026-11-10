"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Web Share API bila tersedia; fallback salin tautan. */
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
  async function share() {
    const url = window.location.href.split("?")[0]!;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Tautan disalin");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Tautan tidak dapat dibagikan");
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
      <Share2 className="size-4" aria-hidden />
      {iconOnly ? null : "Bagikan"}
    </Button>
  );
}
