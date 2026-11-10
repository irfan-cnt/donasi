import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Audit Log — Admin Tebar Kebaikan" };

export default function Page() {
  return <ComingSoon href="/admin/audit" prompt="P22" />;
}
