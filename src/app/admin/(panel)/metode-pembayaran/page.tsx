import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Metode Pembayaran — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/metode-pembayaran" prompt="P22" />;
}
