import type { ReactNode } from "react";
import { PublicSpeedInsights } from "@/components/shared/speed-insights";

// Checkout & pilih pembayaran: Speed Insights (P24) tanpa query string (lihat komponen). Hanya
// di Vercel (VERCEL=1 saat build): di luar Vercel skrip /_vercel/speed-insights tidak ada (404).
export default function DonationFlowLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {process.env.VERCEL ? <PublicSpeedInsights /> : null}
    </>
  );
}
