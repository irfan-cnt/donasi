import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { TotpConfirmForm } from "@/components/admin/admin-auth-forms";
import { AdminAuthCard } from "@/components/admin/auth-card";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTotpUri } from "@/lib/security/totp";
import { getOrCreatePendingTotpSecret } from "@/server/services/admin-auth-service";

export const metadata: Metadata = { title: "Aktifkan Autentikator — Admin Tebar Kebaikan" };

async function Content() {
  const ctx = await requireAdmin(null, { allowPendingStep: true });
  if (ctx.mustChangePassword) redirect("/admin/ganti-password");
  if (ctx.totpEnabled) redirect("/admin");

  const secret = await getOrCreatePendingTotpSecret(ctx.adminId);
  const qr = await QRCode.toDataURL(buildTotpUri(ctx.email, secret), { margin: 1, width: 220 });
  return (
    <>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
        <li>Buka Google Authenticator, Microsoft Authenticator, atau aplikasi sejenis.</li>
        <li>Pindai kode QR di bawah.</li>
        <li>Masukkan 6 digit kode yang muncul.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL lokal, bukan aset */}
      <img
        src={qr}
        alt="Kode QR untuk aplikasi autentikator"
        width={220}
        height={220}
        className="mx-auto mt-4 rounded-lg border border-border"
      />
      <details className="mt-3 text-sm text-ink-soft">
        <summary className="cursor-pointer font-semibold text-primary">
          Tidak bisa memindai? Masukkan kunci manual
        </summary>
        <code className="mt-2 block rounded bg-muted p-2 font-mono text-xs break-all">
          {secret}
        </code>
      </details>
      <TotpConfirmForm />
    </>
  );
}

export default function TotpSetupPage() {
  return (
    <AdminAuthCard title="Aktifkan autentikator (2FA)">
      <Suspense fallback={<div className="mt-5 h-96 animate-pulse rounded-lg bg-muted" />}>
        <Content />
      </Suspense>
    </AdminAuthCard>
  );
}
