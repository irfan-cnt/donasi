import Image from "next/image";
import { cn } from "@/lib/utils";

// Aset dari scripts/brand-assets.ts (sumber: assets/brand-src/). Rasio logo lebar ≈ 5.118:1.
const WIDE = { src: "/brand/logo-wide-56@2x.png", ratio: 1950 / 381 };
const ICON = { src: "/brand/logo-icon-128.png" };

const HEIGHT = { xs: 28, sm: 32, md: 40, lg: 56 } as const;

/**
 * Logo Tebar Kebaikan (aset milik PM). Jangan diwarnai ulang. Di latar gelap (`onDark`) logo
 * ditaruh di atas chip putih karena wordmark hijau tua tidak terbaca di atas hijau tua.
 */
export function Logo({
  className,
  variant = "full",
  size = "md",
  onDark = false,
  priority = false,
}: {
  className?: string;
  variant?: "full" | "icon";
  size?: keyof typeof HEIGHT;
  onDark?: boolean;
  /** Hanya untuk header publik (LCP). */
  priority?: boolean;
}) {
  const h = HEIGHT[size];
  const img =
    variant === "icon" ? (
      <Image
        src={ICON.src}
        alt="Tebar Kebaikan"
        width={h}
        height={h}
        priority={priority}
        className="block"
      />
    ) : (
      <Image
        src={WIDE.src}
        alt="Tebar Kebaikan"
        width={Math.round(h * WIDE.ratio)}
        height={h}
        priority={priority}
        className="block h-auto max-w-full"
      />
    );

  return (
    <span
      data-testid="brand-logo"
      className={cn(
        "inline-flex shrink-0 items-center",
        onDark && "rounded-xl bg-white shadow-sm",
        onDark && (variant === "icon" ? "p-1.5" : "px-3 py-2"),
        className,
      )}
    >
      {img}
    </span>
  );
}
