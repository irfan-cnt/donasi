import { LogIn, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/shared/logo";
import { LP_WRAP, lpButton } from "./landing-ui";
import { PublicHeaderNav } from "./public-header-nav";

const DONOR_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Tombol akun: optimistis berdasarkan keberadaan cookie sesi (sama seperti proxy). Validasi
 * sesi sebenarnya tetap di /akun (requireDonor). Dibungkus Suspense agar shell tetap statis.
 */
async function AccountLink({ drawer }: { drawer?: boolean }) {
  const store = await cookies();
  const loggedIn = DONOR_COOKIES.some((name) => store.has(name));
  const className = drawer
    ? lpButton("line", "md", "w-full")
    : lpButton("line", "sm", "max-sm:hidden");
  return loggedIn ? (
    <Link href="/akun" className={className}>
      <UserRound aria-hidden />
      Akun Saya
    </Link>
  ) : (
    <Link href="/masuk" className={className}>
      <LogIn aria-hidden />
      Masuk
    </Link>
  );
}

/** Header publik — tampilan desain beranda Nov 2026 (palet .lp, lihat globals.css). */
export function PublicHeader() {
  return (
    <header
      data-site-header
      className="lp sticky top-0 z-30 border-b border-transparent bg-[rgb(250_250_247/0.9)] backdrop-blur-[14px] backdrop-saturate-[1.4] transition-[border-color,box-shadow] duration-200 data-[scrolled]:border-border data-[scrolled]:shadow-[0_8px_28px_-22px_rgba(6,68,38,.5)]"
    >
      <div className={`${LP_WRAP} flex h-16 items-center gap-3 sm:h-[72px] sm:gap-6`}>
        <Link href="/" aria-label="Tebar Kebaikan — Beranda" className="shrink-0">
          <Logo priority />
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
          <PublicHeaderNav
            account={
              <Suspense fallback={null}>
                <AccountLink drawer />
              </Suspense>
            }
          />
          <Suspense fallback={<span className="h-11 w-24 max-sm:hidden" />}>
            <AccountLink />
          </Suspense>
          <Link href="/#program" className={lpButton("orange", "sm", "max-sm:hidden")}>
            Donasi Sekarang
          </Link>
        </div>
      </div>
    </header>
  );
}
