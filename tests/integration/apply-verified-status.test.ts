/**
 * applyVerifiedStatus terhadap DB nyata (branch Neon `dev`). Hanya berjalan bila NEON_BRANCH=dev.
 * Membuat campaign/donor/transaksi/payment uji sendiri dan menghapusnya di afterAll; baris seed
 * hanya dibaca (kategori, provider, metode). receipt_counters dikembalikan bila tidak ada
 * penerbit lain di antaranya.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTxDb } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import {
  applyVerifiedStatus,
  type ApplyVerifiedStatusInput,
} from "@/lib/payments/apply-verified-status";
import { newId } from "@/lib/id";
import { FakeProvider } from "../support/fake-payment-provider";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const AMOUNT = 75_000n;

describe.skipIf(!ENABLED)("applyVerifiedStatus (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const log = createLogger({ test: "apply-verified-status" });
  const provider = new FakeProvider();
  const campaignId = newId();
  const donorId = newId();
  const txIds: string[] = [];
  const paymentIds: string[] = [];
  let providerId: string;
  let methodId: string;
  let receiptsIssued = 0;
  const year = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(
      new Date(),
    ),
  );

  const apply = (input: ApplyVerifiedStatusInput) =>
    getTxDb().transaction((tx) => applyVerifiedStatus(tx, input, log));

  async function newPendingPayment(): Promise<{ txId: string; paymentId: string }> {
    const txId = newId();
    const paymentId = newId();
    const code = `TK-000000-${randomBytes(3)
      .toString("hex")
      .toUpperCase()
      .replace(/[ILOU]/g, "A")
      .padEnd(6, "A")
      .slice(0, 6)}`;
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id,
        amount, status, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot)
      values (${txId}, ${code}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${donorId},
        ${AMOUNT.toString()}, 'created', 'Campaign uji pembayaran', 'Uji', ${`it+${donorId}@example.test`})`;
    txIds.push(txId);
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, amount, status)
      values (${paymentId}, ${txId}, ${methodId}, ${providerId}, ${AMOUNT.toString()}, 'created')`;
    paymentIds.push(paymentId);
    const created = await provider.createPayment({
      paymentId,
      transactionCode: code,
      amount: AMOUNT,
      method: { code: "bca_va", type: "virtual_account", providerChannel: "bca" },
      customer: { name: "Uji", email: "it@example.test" },
      description: "uji",
      expiresInMinutes: 60,
      successRedirectUrl: "http://localhost/sukses",
    });
    const r = await apply({
      paymentId,
      status: created.status,
      amount: AMOUNT,
      paidAt: null,
      source: "reconcile",
      eventId: null,
      providerRef: created.providerRef,
    });
    expect(r.outcome).toBe("processed");
    expect(r.transactionStatus).toBe("pending");
    return { txId, paymentId };
  }

  const campaign = async () =>
    (
      await sql`select collected_amount::text as c, donor_count as n from campaigns where id = ${campaignId}`
    )[0] as { c: string; n: number };

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] =
      await sql`select m.id, m.provider_id from payment_methods m join payment_providers p on p.id = m.provider_id where p.code = 'midtrans' and left(m.code, 3) <> 'it_' limit 1`;
    if (!cat || !m) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji pembayaran', ${`it-pay-${campaignId}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it+${donorId}@example.test`}, 'Uji')`;
  });

  afterAll(async () => {
    if (paymentIds.length) {
      await sql`delete from payment_events where payment_id = any(${paymentIds}::uuid[])`;
      await sql`delete from audit_logs where entity_type = 'payment' and entity_id = any(${paymentIds}::text[])`;
      await sql`delete from payments where id = any(${paymentIds}::uuid[])`;
    }
    if (txIds.length) await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from audit_logs where entity_type = 'campaign' and entity_id = ${campaignId}`;
    await sql`delete from campaigns where id = ${campaignId}`;
    // Kembalikan counter hanya bila tak ada kuitansi lain yang terbit sesudah milik uji.
    if (receiptsIssued) {
      await sql`update receipt_counters set last_seq = last_seq - ${receiptsIssued}
        where year = ${year} and not exists (
          select 1 from transactions where receipt_no like ${`KW/${year}/%`}
            and substring(receipt_no from 9)::int > last_seq - ${receiptsIssued})`;
    }
  });

  it("5 panggilan paralel paid → total campaign +1 kali, tepat satu nomor kuitansi", async () => {
    const { txId, paymentId } = await newPendingPayment();
    provider.set(paymentId, "paid");
    const st = await provider.getPaymentStatus({
      providerRef: `fake-${paymentId}`,
      orderId: paymentId,
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        apply({
          paymentId,
          status: st.status,
          amount: st.paidAmount!,
          paidAt: st.paidAt!,
          source: "webhook",
          eventId: null,
        }),
      ),
    );
    receiptsIssued += results.filter((r) => r.becamePaid).length;

    expect(results.filter((r) => r.becamePaid)).toHaveLength(1);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "duplicate")).toHaveLength(4);
    const winner = results.find((r) => r.becamePaid)!;
    expect(winner.receiptNo).toMatch(new RegExp(`^KW/${year}/\\d{6}$`));

    expect(await campaign()).toEqual({ c: AMOUNT.toString(), n: 1 });
    const [t] =
      await sql`select status, receipt_no, paid_at is not null as has_paid_at from transactions where id = ${txId}`;
    expect(t).toEqual({ status: "paid", receipt_no: winner.receiptNo, has_paid_at: true });
    const [p] = await sql`select status from payments where id = ${paymentId}`;
    expect(p!.status).toBe("paid");
  });

  it("expired setelah paid diabaikan (anomali tercatat, total tetap)", async () => {
    const paymentId = paymentIds[0]!;
    const before = await campaign();
    const r = await apply({
      paymentId,
      status: "expired",
      amount: null,
      paidAt: null,
      source: "expiry_job",
      eventId: null,
    });
    expect(r).toMatchObject({
      outcome: "ignored_transition",
      changed: false,
      becamePaid: false,
      newStatus: "paid",
    });
    expect(await campaign()).toEqual(before);
    const [p] = await sql`select status from payments where id = ${paymentId}`;
    expect(p!.status).toBe("paid");
    const ev =
      await sql`select result, status_reported from payment_events where payment_id = ${paymentId}`;
    expect(ev).toContainEqual({ result: "ignored_transition", status_reported: "expired" });
  });

  it("amount mismatch → tidak paid, alert dikembalikan, tidak menambah total", async () => {
    const { txId, paymentId } = await newPendingPayment();
    const before = await campaign();
    provider.set(paymentId, "paid", AMOUNT - 1n);
    const st = await provider.getPaymentStatus({
      providerRef: `fake-${paymentId}`,
      orderId: paymentId,
    });
    const r = await apply({
      paymentId,
      status: st.status,
      amount: st.paidAmount!,
      paidAt: st.paidAt!,
      source: "webhook",
      eventId: null,
    });
    expect(r).toMatchObject({ outcome: "amount_mismatch", changed: false, becamePaid: false });
    expect(r.alert).toMatchObject({
      kind: "amount_mismatch",
      expectedAmount: AMOUNT,
      reportedAmount: AMOUNT - 1n,
    });
    expect(await campaign()).toEqual(before);
    const [t] = await sql`select status, receipt_no from transactions where id = ${txId}`;
    expect(t).toEqual({ status: "pending", receipt_no: null });
    const [p] = await sql`select status from payments where id = ${paymentId}`;
    expect(p!.status).toBe("pending");
    const ev = await sql`select result from payment_events where payment_id = ${paymentId}`;
    expect(ev).toContainEqual({ result: "amount_mismatch" });
  });

  it("paid tanpa nominal ditolak; payment tak dikenal → unknown_payment", async () => {
    const r1 = await apply({
      paymentId: paymentIds[1]!,
      status: "paid",
      amount: null,
      paidAt: new Date(),
      source: "admin_check",
      eventId: null,
    });
    expect(r1.outcome).toBe("amount_mismatch");
    const r2 = await apply({
      paymentId: randomUUID(),
      status: "paid",
      amount: AMOUNT,
      paidAt: new Date(),
      source: "webhook",
      eventId: null,
    });
    expect(r2).toMatchObject({
      outcome: "unknown_payment",
      changed: false,
      alert: { kind: "unknown_payment" },
    });
  });

  it("refund dari webhook/reconcile tidak pernah diterapkan → alert refund_reported + audit", async () => {
    const { paymentId } = await newPendingPayment();
    for (const source of ["webhook", "reconcile", "expiry_job"] as const) {
      const r = await apply({
        paymentId,
        status: "refunded",
        amount: AMOUNT,
        paidAt: null,
        source,
        eventId: null,
        needsReview: true,
      });
      expect(r).toMatchObject({
        outcome: "ignored_transition",
        changed: false,
        alert: { kind: "refund_reported", source },
      });
    }
    const [p] = await sql`select status from payments where id = ${paymentId}`;
    expect(p).toEqual({ status: "pending" });
    const audits = await sql`select action from audit_logs where entity_id = ${paymentId}
      and action = 'payment.needs_review'`;
    expect(audits).toHaveLength(3);
    // admin_check melewati guard refund (state machine tetap berlaku: pending ↛ refunded).
    const r = await apply({
      paymentId,
      status: "refunded",
      amount: AMOUNT,
      paidAt: null,
      source: "admin_check",
      eventId: null,
    });
    expect(r).toMatchObject({ outcome: "ignored_transition", alert: null });
  });

  it("P25 OD-28: refund penuh admin_check (paralel) → total berkurang tepat sekali + audit", async () => {
    const { txId, paymentId } = await newPendingPayment();
    provider.set(paymentId, "paid");
    const paid = await apply({ paymentId, status: "paid", amount: AMOUNT, paidAt: new Date(), source: "webhook", eventId: null });
    expect(paid.becamePaid).toBe(true);
    receiptsIssued += 1;
    const before = await campaign();
    const refund = () =>
      apply({ paymentId, status: "refunded", amount: null, paidAt: null, source: "admin_check", eventId: null, needsReview: true });
    const results = await Promise.all([refund(), refund(), refund()]);
    expect(results.filter((r) => r.transactionStatus === "refunded")).toHaveLength(1);
    const after = await campaign();
    expect(BigInt(after.c)).toBe(BigInt(before.c) - AMOUNT);
    expect(after.n).toBe(before.n - 1);
    const [t] = await sql`select status from transactions where id = ${txId}`;
    expect(t).toEqual({ status: "refunded" });
    const audits = await sql`select metadata from audit_logs where entity_id = ${campaignId} and action = 'campaign.total_reversed'
      and metadata->>'paymentId' = ${paymentId}`;
    expect(audits).toHaveLength(1);
    // Paid ulang setelah refunded tidak pernah menambah total lagi (state machine + guard BR-19).
    const again = await apply({ paymentId, status: "paid", amount: AMOUNT, paidAt: new Date(), source: "webhook", eventId: null });
    expect(again.becamePaid).toBe(false);
    expect(await campaign()).toEqual(after);
  });

  it("P25 OD-28: partial_refund tidak diterapkan (needs_review), total tetap", async () => {
    const { txId, paymentId } = await newPendingPayment();
    provider.set(paymentId, "paid");
    await apply({ paymentId, status: "paid", amount: AMOUNT, paidAt: new Date(), source: "webhook", eventId: null });
    receiptsIssued += 1;
    const before = await campaign();
    const r = await apply({
      paymentId, status: "refunded", amount: null, paidAt: null, source: "admin_check", eventId: null,
      needsReview: true, partialRefund: true,
    });
    expect(r).toMatchObject({ outcome: "ignored_transition", changed: false, alert: { kind: "refund_reported" } });
    expect(await campaign()).toEqual(before);
    const [t] = await sql`select status from transactions where id = ${txId}`;
    expect(t).toEqual({ status: "paid" });
  });

  it("pending + needsReview (capture/challenge) → alert needs_review + audit, status tetap", async () => {
    const { paymentId } = await newPendingPayment();
    const r = await apply({
      paymentId,
      status: "pending",
      amount: AMOUNT,
      paidAt: null,
      source: "webhook",
      eventId: null,
      needsReview: true,
    });
    expect(r).toMatchObject({
      outcome: "duplicate",
      changed: false,
      alert: { kind: "needs_review", reportedStatus: "pending" },
    });
    const audits = await sql`select action from audit_logs where entity_id = ${paymentId}`;
    expect(audits).toContainEqual({ action: "payment.needs_review" });
  });
});
