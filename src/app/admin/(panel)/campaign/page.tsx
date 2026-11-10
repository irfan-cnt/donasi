import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Campaign — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/campaign" prompt="P21" />;
}
