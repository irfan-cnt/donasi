import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/admin-auth-forms";
import { AdminAuthCard } from "@/components/admin/auth-card";
import { getAdminContext } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Masuk Admin — Tebar Kebaikan",
  robots: { index: false, follow: false },
};

// Halaman publik satu-satunya di /admin: tidak memanggil requireAdmin, tetapi admin yang
// sudah masuk langsung diarahkan ke /admin.
async function LoginGate() {
  await connection();
  if (await getAdminContext()) redirect("/admin");
  return <AdminLoginForm />;
}

export default function AdminLoginPage() {
  return (
    <AdminAuthCard title="Masuk sebagai admin">
      <Suspense fallback={<div className="mt-5 h-72 animate-pulse rounded-lg bg-muted" />}>
        <LoginGate />
      </Suspense>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
        <ShieldCheck className="size-3.5" aria-hidden />
        Akun admin terpisah dari akun donatur. Lupa password? Hubungi owner.
      </p>
    </AdminAuthCard>
  );
}
