import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Template Notifikasi — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/template-notifikasi" prompt="P23" />;
}
