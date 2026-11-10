// @sandbox — panggilan nyata ke Midtrans SANDBOX. Dilewati otomatis bila kunci sandbox kosong.
// Tidak pernah memanggil production; tidak menulis DB (recordEvent no-op).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMidtransProvider } from "@/lib/payments/midtrans/provider";

const key = process.env.MIDTRANS_SERVER_KEY ?? "";
const enabled = key.startsWith("SB-Mid-server-") && process.env.MIDTRANS_IS_PRODUCTION !== "true";

describe.skipIf(!enabled)("@sandbox Midtrans Core API", () => {
  const provider = createMidtransProvider({
    serverKey: key,
    isProduction: false,
    recordEvent: async () => {},
  });

  it("charge BCA VA → status pending → expire", { timeout: 40_000 }, async () => {
    const orderId = randomUUID();
    const r = await provider.createPayment({
      paymentId: orderId,
      transactionCode: "TK-261110-SANDBX",
      amount: 10_000n,
      method: { code: "bca_va", type: "virtual_account", providerChannel: "bca" },
      customer: { name: "Uji Sandbox", email: "sandbox@example.com" },
      description: "Uji integrasi sandbox",
      expiresInMinutes: 15,
      successRedirectUrl: "https://example.org/selesai",
    });
    expect(r.status).toBe("pending");
    expect(r.instruction.vaNumber).toMatch(/^\d+$/);
    const s = await provider.getPaymentStatus({ orderId, providerRef: r.providerRef });
    expect(s.status).toBe("pending");
    await provider.expirePayment({ orderId, providerRef: r.providerRef });
    expect((await provider.getPaymentStatus({ orderId, providerRef: r.providerRef })).status).toBe(
      "expired",
    );
  });
});
