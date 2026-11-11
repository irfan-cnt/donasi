import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { LEGAL_PAGES } from "@/lib/legal/content";
import { LP_WRAP } from "./landing-ui";

const LINK = "inline-flex min-h-9 items-center text-[14.5px] text-[#CFE0D5] hover:text-white";
const HEADING = "mb-3.5 text-[15px] font-bold text-white";

// Footer publik — tampilan desain beranda Nov 2026. Tautan halaman legal (T-49, OD-08,
// AC-32.2) tetap dari satu sumber: src/lib/legal/content.ts.
export function Footer() {
  const info = LEGAL_PAGES.filter((p) => p.path !== "/kontak");
  return (
    <footer className="lp lp-dark mt-12 bg-primary-ink pt-14 text-[#CFE0D5] sm:pt-[72px]">
      <div
        className={`${LP_WRAP} grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-10`}
      >
        <div className="col-span-2 lg:col-span-1">
          <Logo onDark size="sm" />
          <p className="mt-[18px] max-w-xs text-[14.5px] leading-[1.7]">
            Platform donasi yang amanah dan transparan. Setiap rupiah tercatat, setiap penyaluran
            dilaporkan.
          </p>
        </div>
        <nav aria-label="Navigasi footer">
          <p className={HEADING}>Jelajahi</p>
          <ul className="grid gap-0.5">
            <li>
              <Link href="/" className={LINK}>
                Beranda
              </Link>
            </li>
            <li>
              <Link href="/campaign" className={LINK}>
                Program Donasi
              </Link>
            </li>
            <li>
              <Link href="/akun" className={LINK}>
                Akun Donatur
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Informasi">
          <p className={HEADING}>Informasi</p>
          <ul className="grid gap-0.5">
            {info.map((p) => (
              <li key={p.path}>
                <Link href={p.path} className={LINK}>
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-2 lg:col-span-1">
          <p className={HEADING}>Kontak</p>
          <ul className="grid gap-3 text-[14.5px]">
            <li className="flex items-start gap-2.5">
              <ShieldCheck className="mt-[3px] size-4 shrink-0 text-brand-yellow" aria-hidden />
              <span>Pembayaran diproses oleh payment gateway berizin Bank Indonesia.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Lock className="mt-[3px] size-4 shrink-0 text-brand-yellow" aria-hidden />
              <span>Kami tidak pernah meminta PIN atau OTP.</span>
            </li>
          </ul>
          <Link
            href="/kontak"
            className="mt-[18px] inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-3.5 text-[13px] font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/[0.12]"
          >
            Hubungi Kami <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
      <div className={`${LP_WRAP} mt-10 pb-28 sm:mt-14 md:pb-7`}>
        <div className="flex flex-wrap justify-between gap-3 border-t border-white/[0.12] pt-[22px] text-[13px] text-[#B5CDBE]">
          <span>© Tebar Kebaikan. Seluruh hak cipta dilindungi.</span>
          <span>Donasi yang mudah, tercatat, dan bisa dipantau.</span>
        </div>
      </div>
    </footer>
  );
}
