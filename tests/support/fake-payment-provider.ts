// FakeProvider KHUSUS uji (tidak pernah diekspor dari src/). Status dikendalikan test.
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentInstruction,
  PaymentProvider,
  PaymentStatus,
  ProviderPaymentRef,
  StatusResult,
  VerifiedWebhook,
} from "@/lib/payments/types";

export class FakeProvider implements PaymentProvider {
  readonly code = "midtrans" as const;
  private readonly state = new Map<
    string,
    { status: PaymentStatus; amount: bigint; paidAt?: Date }
  >();

  /** Error yang dilempar createPayment berikutnya (sekali pakai). */
  failNextCreate: Error | null = null;
  /** providerRef paksaan untuk createPayment berikutnya (mis. memicu bentrok constraint). */
  nextProviderRef: string | null = null;

  readonly calls = { create: [] as string[], expire: [] as string[] };

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.calls.create.push(input.paymentId);
    if (this.failNextCreate) {
      const e = this.failNextCreate;
      this.failNextCreate = null;
      throw e;
    }
    this.state.set(input.paymentId, { status: "pending", amount: input.amount });
    const instruction: PaymentInstruction = {
      kind: "virtual_account",
      bankName: "BCA",
      vaNumber: "0000000000",
      expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000),
    };
    const providerRef = this.nextProviderRef ?? `fake-${input.paymentId}`;
    this.nextProviderRef = null;
    return { providerRef, status: "pending", instruction };
  }

  /** Simulasi provider: ubah status/nominal yang akan dilaporkan. */
  set(orderId: string, status: PaymentStatus, amount?: bigint): void {
    const cur = this.state.get(orderId);
    if (!cur) throw new Error(`fake: payment ${orderId} tidak dikenal`);
    this.state.set(orderId, {
      status,
      amount: amount ?? cur.amount,
      paidAt: status === "paid" ? new Date() : cur.paidAt,
    });
  }

  async getPaymentStatus(ref: ProviderPaymentRef): Promise<StatusResult> {
    const s = this.state.get(ref.orderId);
    if (!s) throw new Error("fake: not found");
    return {
      providerRef: ref.providerRef,
      status: s.status,
      paidAmount: s.amount,
      paidAt: s.paidAt,
      raw: {},
    };
  }

  async verifyWebhook(req: { headers: Headers; rawBody: string }): Promise<VerifiedWebhook> {
    if (req.headers.get("x-fake-signature") !== "ok") throw new Error("fake: invalid signature");
    const body = JSON.parse(req.rawBody) as {
      eventId: string;
      orderId: string;
      status: PaymentStatus;
      amount: string;
    };
    return { ...body, providerRef: `fake-${body.orderId}`, amount: BigInt(body.amount), raw: body };
  }

  getPaymentInstructions(payment: {
    providerRef: string;
    instruction: PaymentInstruction;
  }): PaymentInstruction {
    return payment.instruction;
  }

  async expirePayment(ref: ProviderPaymentRef): Promise<void> {
    this.calls.expire.push(ref.orderId);
    this.set(ref.orderId, "expired");
  }
}
