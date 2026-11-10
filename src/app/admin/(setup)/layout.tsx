import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function SetupGate({ children }: { children: React.ReactNode }) {
  await requireAdmin(null, { allowPendingStep: true });
  return <>{children}</>;
}

export default function AdminSetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex-1 bg-primary-ink" aria-busy="true" />}>
      <SetupGate>{children}</SetupGate>
    </Suspense>
  );
}
