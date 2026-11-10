import type { Metadata } from "next";
import { Suspense } from "react";
import { DonorNav } from "@/components/donor/donor-nav";
import { SignOutButton } from "@/components/donor/sign-out-button";
import { BottomNav } from "@/components/public/bottom-nav";
import { PublicHeader } from "@/components/public/public-header";
import { requireDonor } from "@/lib/auth";
import { signOutDonor } from "@/server/actions/auth-actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function DonorGate({ children }: { children: React.ReactNode }) {
  // Lapisan utama proteksi /akun/** (proxy hanya lapisan pertama).
  await requireDonor("/akun");
  return <>{children}</>;
}

export default function DonorAccountLayout({ children }: LayoutProps<"/akun">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <PublicHeader />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 md:grid md:grid-cols-[200px_1fr] md:gap-8 md:pt-8 md:pb-12">
        <aside className="md:sticky md:top-24 md:self-start">
          <Suspense fallback={<div className="h-9" />}>
            <DonorNav />
          </Suspense>
          <form action={signOutDonor} className="mt-3 md:mt-4">
            <SignOutButton />
          </form>
        </aside>
        <div className="mt-4 min-w-0 md:mt-0">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" aria-busy="true" />}>
            <DonorGate>{children}</DonorGate>
          </Suspense>
        </div>
      </div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
