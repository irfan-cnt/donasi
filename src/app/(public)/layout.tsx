import { BottomNav } from "@/components/public/bottom-nav";
import { Footer } from "@/components/public/footer";
import { PublicHeader } from "@/components/public/public-header";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
