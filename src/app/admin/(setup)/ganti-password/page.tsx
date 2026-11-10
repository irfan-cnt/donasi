import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/admin/admin-auth-forms";
import { AdminAuthCard } from "@/components/admin/auth-card";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Ganti Password — Admin Tebar Kebaikan" };

async function Content() {
  const ctx = await requireAdmin(null, { allowPendingStep: true });
  if (ctx.pendingStep === "totp-setup") redirect("/admin/setup-totp");
  return (
    <>
      <p className="mt-2 text-sm text-ink-soft">
        {ctx.mustChangePassword
          ? "Demi keamanan, ganti password sementara sebelum melanjutkan."
          : "Ganti password akun admin. Semua sesi lain akan dikeluarkan."}
      </p>
      <ChangePasswordForm />
    </>
  );
}

export default function ChangePasswordPage() {
  return (
    <AdminAuthCard title="Ganti password">
      <Suspense fallback={<div className="mt-5 h-72 animate-pulse rounded-lg bg-muted" />}>
        <Content />
      </Suspense>
    </AdminAuthCard>
  );
}
