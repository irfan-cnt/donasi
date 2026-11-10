import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Log Pembayaran — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/log-pembayaran" prompt="P22" />;
}
