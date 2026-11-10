import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectionTestButton, PaymentMethodsManager, type MethodDto } from "@/components/admin/finance/payment-methods-manager";
import { formatWibDateTime } from "@/components/donor/format";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnv } from "@/lib/env";
import { isProviderConfigured } from "@/lib/payments/registry";
import { cn } from "@/lib/utils";
import { listAdminMethods, listProviderStatus } from "@/server/repositories/admin-finance-repository";
import { ShieldCheck, XCircle } from "lucide-react";

export const metadata: Metadata = { title: "Metode Pembayaran — Admin Tebar Kebaikan" };

// Metode pembayaran (F-26, AC-26.1): status provider TANPA kredensial (hanya terkonfigurasi /
// belum + mode), daftar metode (aktif, urutan, nama, logo, min/max, masa berlaku, biaya OD-04,
// instruksi per kanal). Simpan → audit + invalidasi cache metode (Redis).
async function Methods() {
  await requireAdmin("payment_methods.write");
  const [methods, providers] = await Promise.all([listAdminMethods(), listProviderStatus()]);
  const env = getEnv();
  const dto: MethodDto[] = methods.map((m) => ({
    id: m.id,
    code: m.code,
    providerCode: m.providerCode,
    providerChannel: m.providerChannel,
    type: m.type,
    displayName: m.displayName,
    logoUrl: m.logoUrl,
    instructions: m.instructions,
    minAmount: m.minAmount.toString(),
    maxAmount: m.maxAmount === null ? "" : m.maxAmount.toString(),
    expiryMinutes: m.expiryMinutes,
    feeFlat: m.feeFlat.toString(),
    feePercent: m.feePercent,
    isActive: m.isActive,
  }));

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Metode Pembayaran</h1>
        <p className="mt-1 text-sm text-ink-faint">Atur metode aktif, urutan, dan instruksi. Kredensial provider dikelola di environment server.</p>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {providers.map((p) => {
          const configured = p.code === "midtrans" && isProviderConfigured("midtrans", env);
          const mode = env.MIDTRANS_IS_PRODUCTION ? "Production" : "Sandbox";
          return (
            <section key={p.code} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4" data-testid="provider-card">
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", configured ? "bg-primary-soft text-primary" : "bg-danger-soft text-danger")}>
                {configured ? <ShieldCheck className="size-5" aria-hidden /> : <XCircle className="size-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-[1_1_180px]">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-ink-faint">
                  <span data-testid="provider-configured">{configured ? "Terkonfigurasi" : "Belum terkonfigurasi"}</span> · {mode} · {p.isEnabled ? "provider aktif" : "provider nonaktif"}
                </p>
                <p className="text-xs text-ink-faint">Webhook terakhir: {p.lastWebhookAt ? formatWibDateTime(p.lastWebhookAt) : "belum pernah"}</p>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", env.MIDTRANS_IS_PRODUCTION ? "bg-primary-soft text-primary-ink" : "bg-warning-soft text-warning")}>{mode}</span>
                {p.code === "midtrans" ? <ConnectionTestButton /> : null}
              </div>
            </section>
          );
        })}
      </div>
      <PaymentMethodsManager methods={dto} />
    </>
  );
}

export default function AdminPaymentMethodsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Methods />
    </Suspense>
  );
}
