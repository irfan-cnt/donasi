import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Berita — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/berita" prompt="P21" />;
}
