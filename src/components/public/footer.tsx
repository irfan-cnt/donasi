import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

// Tautan halaman legal (Tentang, Kebijakan Privasi, S&K, Kontak) ditambahkan di T-49 (OD-08)
// bersama halamannya agar tidak ada tautan 404.
export function Footer() {
  return (
    <footer className="mt-12 bg-primary-ink pb-24 text-white/80 md:pb-0">
      <div className="pattern-islamic">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
          <div className="md:col-span-3">
            <Logo onDark size="sm" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed">
              Platform donasi yang amanah dan transparan. Setiap rupiah tercatat, setiap
              penyaluran dilaporkan.
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs">
              <ShieldCheck className="size-4 shrink-0 text-gold-soft" aria-hidden />
              Pembayaran diproses oleh payment gateway berizin Bank Indonesia.
            </p>
          </div>
          <nav aria-label="Navigasi footer">
            <p className="font-semibold text-white">Jelajahi</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white">
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="/campaign" className="hover:text-white">
                  Semua Program
                </Link>
              </li>
              <li>
                <Link href="/akun" className="hover:text-white">
                  Akun Donatur
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs">Tebar Kebaikan</p>
      </div>
    </footer>
  );
}
