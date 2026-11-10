import { LogIn, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";

const DONOR_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Tombol akun: optimistis berdasarkan keberadaan cookie sesi (sama seperti proxy). Validasi
 * sesi sebenarnya tetap di /akun (requireDonor). Dibungkus Suspense agar shell tetap statis.
 */
async function AccountLink({ mobile }: { mobile?: boolean }) {
  const store = await cookies();
  const loggedIn = DONOR_COOKIES.some((name) => store.has(name));
  if (mobile) {
    return loggedIn ? (
      <Link href="/akun" aria-label="Akun Saya" className={buttonVariants({ variant: "ghost", size: "icon-lg" })}>
        <UserRound className="size-5" aria-hidden />
      </Link>
    ) : (
      <Link href="/masuk" className={buttonVariants({ variant: "ghost", size: "lg" })}>
        Masuk
      </Link>
    );
  }
  return loggedIn ? (
    <Link href="/akun" className={buttonVariants({ variant: "secondary" })}>
      <UserRound aria-hidden />
      Akun Saya
    </Link>
  ) : (
    <Link href="/masuk" className={buttonVariants({ variant: "outline" })}>
      <LogIn aria-hidden />
      Masuk
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="Tebar Kebaikan — Beranda">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            Beranda
          </Link>
          <Link href="/campaign" className={buttonVariants({ variant: "ghost" })}>
            Program
          </Link>
          <Suspense fallback={<span className="h-8 w-20" />}>
            <AccountLink />
          </Suspense>
        </nav>
        <div className="md:hidden">
          <Suspense fallback={<span className="block h-9 w-16" />}>
            <AccountLink mobile />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
