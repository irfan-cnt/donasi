import { BottomNav } from "@/components/public/bottom-nav";
import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/public-header";
import { PublicSpeedInsights } from "@/components/shared/speed-insights";
import { WebAnalytics } from "@/components/shared/web-analytics";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      {/* Sebelum konten: antrean window.va siap sebelum efek anak memanggil track(). */}
      {process.env.VERCEL ? <WebAnalytics /> : null}
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomNav />
      {process.env.VERCEL ? <PublicSpeedInsights /> : null}
    </div>
  );
}
