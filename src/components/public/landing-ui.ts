import { cn } from "@/lib/utils";

// Kelas bersama tampilan beranda (desain Nov 2026): dipakai section landing, header, footer,
// kartu program, dan elemen mengambang. Warna mengikuti token .lp di globals.css.

/** Lebar konten desain: 1200 px (1280 px di layar ≥1536 px), gutter 16/32 px. */
export const LP_WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-8 2xl:max-w-[1280px]";

/** Jarak vertikal antarsection. */
export const LP_SEC = "scroll-mt-[72px] py-[72px] sm:py-[88px] lg:py-[104px]";

const BTN_BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-transparent px-[22px] text-[15px] leading-tight font-bold whitespace-nowrap no-underline transition-[transform,box-shadow,background-color,color,border-color] duration-150 active:translate-y-px motion-reduce:transform-none [&_svg]:size-[18px] [&_svg]:shrink-0";

const BTN_VARIANT = {
  orange:
    "bg-brand-orange text-[#2A1B00] hover:-translate-y-px hover:bg-[#FBAE2D] hover:shadow-[0_12px_26px_-12px_rgba(245,158,11,.85)]",
  green:
    "bg-primary text-white hover:-translate-y-px hover:bg-primary-hover hover:shadow-[0_12px_26px_-14px_rgba(7,92,50,.8)]",
  line: "border-[#D3DED6] bg-white text-primary hover:border-primary hover:bg-[#F4F8F5] hover:text-primary-hover",
  ghost: "border-white/40 bg-transparent text-white hover:border-white/70 hover:bg-white/10",
} as const;

const BTN_SIZE = {
  md: "",
  lg: "min-h-14 rounded-[14px] px-7 text-base max-[380px]:min-h-[52px] max-[380px]:px-5 max-[380px]:text-[15px]",
  sm: "min-h-11 rounded-[10px] px-4 text-sm",
} as const;

export function lpButton(
  variant: keyof typeof BTN_VARIANT,
  size: keyof typeof BTN_SIZE = "md",
  className?: string,
) {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className);
}

/** Label kecil di atas judul section (garis oranye + teks kapital). */
export const LP_EYEBROW =
  "inline-flex items-center gap-2.5 text-[13px] font-bold tracking-[0.08em] text-gold uppercase before:h-0.5 before:w-[22px] before:rounded-sm before:bg-brand-orange before:content-['']";

export const LP_H2 =
  "mt-3 text-[clamp(28px,3.3vw,42px)] leading-[1.12] font-extrabold tracking-[-0.03em]";

export const LP_SUB = "mt-3 max-w-[580px] text-[17px] leading-[1.65] text-ink-faint";

/** Pil di atas latar gelap (hero, CTA penutup). */
export const LP_EYEBROW_DARK =
  "inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.08] py-1.5 pr-3.5 pl-2.5 text-[13px] font-semibold text-[#DDEBE1] before:size-2 before:shrink-0 before:rounded-full before:bg-brand-orange before:shadow-[0_0_0_4px_rgba(245,158,11,.22)] before:content-['']";
