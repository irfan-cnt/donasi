import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Log Notifikasi — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/log-notifikasi" prompt="P23" />;
}
