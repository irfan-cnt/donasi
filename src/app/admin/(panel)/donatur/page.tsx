import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Donatur — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/donatur" prompt="P22" />;
}
