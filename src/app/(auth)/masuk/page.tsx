import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GoogleSignInButton } from "@/components/donor/google-sign-in-button";
import { Logo } from "@/components/shared/logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { auth } from "@/lib/auth";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { signInWithGoogle } from "@/server/actions/auth-actions";

export const metadata: Metadata = {
  title: "Masuk — Tebar Kebaikan",
  robots: { index: false },
};

const BENEFITS = [
  "Tanpa password untuk diingat",
  "Donasi tetap bisa tanpa akun",
  "Kami tidak pernah memposting atas namamu",
];

async function LoginForm({ searchParams }: { searchParams: PageProps<"/masuk">["searchParams"] }) {
  await connection(); // sesi dibaca per request
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(params.callbackUrl);
  const session = await auth();
  if (session?.user?.id) redirect(callbackUrl);
  const hasError = typeof params.error === "string" && params.error.length > 0;

  return (
    <>
      {hasError && (
        <Alert variant="destructive" className="mt-5">
          <AlertTitle>Gagal masuk</AlertTitle>
          <AlertDescription>
            Login dibatalkan atau email Google belum terverifikasi. Silakan coba lagi.
          </AlertDescription>
        </Alert>
      )}
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <GoogleSignInButton />
      </form>
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <main className="grid min-h-screen flex-1 bg-bg md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary-ink p-10 text-white md:flex md:flex-col md:justify-between">
        <div className="absolute inset-0 pattern-islamic" aria-hidden />
        <div className="relative">
          <Logo light />
        </div>
        <figure className="relative">
          <blockquote className="font-display text-4xl leading-tight font-bold">
            “Harta tidak akan berkurang karena sedekah.”
          </blockquote>
          <figcaption className="mt-3 text-white/70">— HR. Muslim</figcaption>
        </figure>
        <p className="relative text-sm text-white/60">
          Riwayat donasi &amp; kuitansi tersimpan rapi di satu tempat.
        </p>
      </div>
      <div className="flex flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="md:hidden">
            <Logo />
          </div>
          <h1 className="mt-8 text-2xl font-bold text-ink md:mt-0">Masuk ke akunmu</h1>
          <p className="mt-2 text-sm text-ink-faint">
            Lihat riwayat donasi, unduh kuitansi, dan kelola notifikasi. Donasi dengan email yang
            sama otomatis tersambung.
          </p>
          <Suspense
            fallback={<div className="mt-6 h-12 w-full animate-pulse rounded-lg bg-muted" />}
          >
            <LoginForm searchParams={searchParams} />
          </Suspense>
          <ul className="mt-6 space-y-2 text-sm text-ink-soft">
            {BENEFITS.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-ink-faint">
            Dengan masuk, kamu menyetujui Syarat &amp; Ketentuan serta Kebijakan Privasi Tebar
            Kebaikan.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-primary">
            ← Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
