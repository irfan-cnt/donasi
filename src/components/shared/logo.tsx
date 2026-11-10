import { cn } from "@/lib/utils";

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? "#ffffff" : "rgb(13 110 86)"} />
        <path
          d="M16 6c4.5 5.2 7 9 7 12.2A7 7 0 0 1 9 18.2C9 15 11.5 11.2 16 6z"
          fill={light ? "rgb(13 110 86)" : "#fff"}
        />
        <path
          d="M16 24v-7m0 2.5 3-2.5"
          stroke={light ? "#fff" : "rgb(183 135 46)"}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span
        className={cn(
          "font-display text-lg leading-none font-bold tracking-tight",
          light ? "text-white" : "text-ink",
        )}
      >
        Tebar<span className={light ? "text-gold-soft" : "text-primary"}>Kebaikan</span>
      </span>
    </span>
  );
}
