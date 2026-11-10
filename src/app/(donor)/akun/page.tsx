import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/donor/sign-out-button";
import { Logo } from "@/components/shared/logo";
import { requireDonor } from "@/lib/auth";
import { signOutDonor } from "@/server/actions/auth-actions";

export const metadata: Metadata = { title: "Akun — Tebar Kebaikan" };

async function Greeting() {
  const donor = await requireDonor("/akun");
  return (
    <>
      <h1 className="mt-8 text-2xl font-bold text-ink">Assalamu’alaikum, {donor.name}</h1>
      <p className="mt-2 text-sm text-ink-faint">{donor.email}</p>
    </>
  );
}

// Kerangka akun; dashboard lengkap menyusul di P18.
export default function DonorAccountPage() {
  return (
    <main className="container flex-1 py-10">
      <div className="flex items-center justify-between gap-4">
        <Logo />
        <form action={signOutDonor}>
          <SignOutButton />
        </form>
      </div>
      <Suspense fallback={<div className="mt-8 h-8 w-64 animate-pulse rounded bg-muted" />}>
        <Greeting />
      </Suspense>
    </main>
  );
}
