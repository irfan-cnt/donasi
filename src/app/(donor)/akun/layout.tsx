import type { Metadata } from "next";
import { Suspense } from "react";
import { requireDonor } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false } };

async function DonorGate({ children }: { children: React.ReactNode }) {
  // Lapisan utama proteksi /akun/** (proxy hanya lapisan pertama).
  await requireDonor("/akun");
  return <>{children}</>;
}

export default function DonorAccountLayout({ children }: LayoutProps<"/akun">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <DonorGate>{children}</DonorGate>
    </Suspense>
  );
}
