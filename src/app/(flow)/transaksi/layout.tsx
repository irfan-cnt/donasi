import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

// Toaster hanya di halaman transaksi (CopyField memakai toast). Tidak dipasang di root layout
// agar sonner tidak masuk bundle halaman publik lain (P24, NFR-04).
export default function TransactionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster theme="light" />
    </>
  );
}
