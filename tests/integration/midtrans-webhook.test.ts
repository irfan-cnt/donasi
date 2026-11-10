/**
 * Webhook Midtrans end-to-end di level handler (P13) terhadap DB nyata (branch Neon `dev`) dengan
 * HTTP Midtrans di-mock (fetch). Hanya berjalan bila NEON_BRANCH=dev. Membuat campaign/donor/
 * transaksi/payment uji sendiri dan menghapusnya di afterAll; seed hanya dibaca.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createLogger } from "@/lib/logger";
import { newId } from "@/lib/id";
import { computeSignature } from "@/lib/payments/midtrans/mapping";
import { createMidtransProvider } from "@/lib/payments/midtrans/provider";
import {
  handleMidtransWebhook,
  type MidtransWebhookDeps,
} from "@/lib/payments/webhook/midtrans-webhook";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const SERVER_KEY = "SB-Mid-server-WEBHOOKITKEY01";
const AMOUNT = 60_000n;

describe.skipIf(!ENABLED)("webhook Midtrans (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const log = createLogger({ test: "midtrans-webhook" });
  const campaignId = newId();
  const donorId = newId();
  const txIds: string[] = [];
  const paymentIds: string[] = [];
  const orderIds: string[] = [];
  let providerId: string;
  let methodId: string;
  let receiptsIssued = 0;
  const year = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(
      new Date(),
    ),
  );

  /** Status API Midtrans per order_id (dikendalikan test). */
  const apiState = new Map<string, Record<string, unknown>>();
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const m = /\/v2\/([^/]+)\/status$/.exec(String(url));
    const body = (m && apiState.get(decodeURIComponent(m[1]!))) ?? {
      status_code: "404",
      status_message: "Transaction doesn't exist.",
    };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const provider = createMidtransProvider({
    serverKey: SERVER_KEY,
    isProduction: false,
    recordEvent: async () => {},
    fetch: fetchMock as unknown as typeof fetch,
    logger: log,
  });
  const publishPaid = vi.fn<MidtransWebhookDeps["publishPaid"]>(async () => {});
  const revalidateCampaign = vi.fn<MidtransWebhookDeps["revalidateCampaign"]>(async () => {});
  const onRejectedSignature = vi.fn(async () => false);
  const deps: MidtransWebhookDeps = {
    provider,
    publishPaid,
    revalidateCampaign,
    onRejectedSignature,
    log,
  };

  const setApi = (orderId: string, trxId: string, status: string, gross = `${AMOUNT}.00`) =>
    apiState.set(orderId, {
      status_code: status === "settlement" ? "200" : "201",
      order_id: orderId,
      transaction_id: trxId,
      transaction_status: status,
      gross_amount: gross,
      transaction_time: "2026-11-10 10:00:00",
      settlement_time: status === "settlement" ? "2026-11-10 10:05:00" : undefined,
      fraud_status: "accept",
    });

  const notification = (
    orderId: string,
    trxId: string,
    status: string,
    over: { gross?: string; key?: string } = {},
  ) => {
    const statusCode = status === "settlement" ? "200" : "201";
    const gross = over.gross ?? `${AMOUNT}.00`;
    return JSON.stringify({
      transaction_time: "2026-11-10 10:00:00",
      transaction_status: status,
      transaction_id: trxId,
      status_message: "midtrans payment notification",
      status_code: statusCode,
      signature_key: computeSignature(orderId, statusCode, gross, over.key ?? SERVER_KEY),
      payment_type: "bank_transfer",
      order_id: orderId,
      merchant_id: "G000000000",
      gross_amount: gross,
      fraud_status: "accept",
      currency: "IDR",
      va_numbers: [{ va_number: "812785002530231", bank: "bca" }],
    });
  };

  const post = (rawBody: string) =>
    handleMidtransWebhook(
      { headers: new Headers({ "content-type": "application/json" }), rawBody },
      deps,
    );

  async function newPayment(status: "pending" | "expired" = "pending") {
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
        ${AMOUNT.toString()}, ${status}, 'Campaign uji webhook', 'Uji', ${`it+${donorId}@example.test`})`;
    txIds.push(txId);
    const midTrxId = randomUUID();
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, provider_ref, amount, status, expires_at)
      values (${paymentId}, ${txId}, ${methodId}, ${providerId}, ${midTrxId}, ${AMOUNT.toString()},
        ${status}, now() + interval '1 hour')`;
    paymentIds.push(paymentId);
    orderIds.push(paymentId);
    return { txId, paymentId, midTrxId };
  }

  const campaign = async () =>
    (
      await sql`select collected_amount::text as c, donor_count as n from campaigns where id = ${campaignId}`
    )[0] as { c: string; n: number };
  const paymentStatus = async (id: string) =>
    ((await sql`select status from payments where id = ${id}`)[0] as { status: string }).status;
  const events = async (orderId: string) =>
    (await sql`select verification, result, provider_event_id, payload from payment_events
      where payload->>'order_id' = ${orderId} order by received_at`) as Array<{
      verification: string;
      result: string;
      provider_event_id: string | null;
      payload: Record<string, unknown>;
    }>;

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] =
      await sql`select m.id, m.provider_id from payment_methods m join payment_providers p on p.id = m.provider_id where p.code = 'midtrans' limit 1`;
    if (!cat || !m) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji webhook', ${`it-wh-${campaignId}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it+${donorId}@example.test`}, 'Uji')`;
  });

  afterAll(async () => {
    if (orderIds.length) {
      const evIds = (
        await sql`select id::text from payment_events where payload->>'order_id' = any(${orderIds}::text[])
          or payment_id = any(${paymentIds}::uuid[])`
      ).map((r) => r.id as string);
      await sql`delete from audit_logs where entity_id = any(${[...paymentIds, ...evIds, ...txIds]}::text[])`;
      await sql`delete from payment_events where id = any(${evIds}::uuid[])`;
    }
    if (paymentIds.length) await sql`delete from payments where id = any(${paymentIds}::uuid[])`;
    if (txIds.length) await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from campaigns where id = ${campaignId}`;
    if (receiptsIssued) {
      await sql`update receipt_counters set last_seq = last_seq - ${receiptsIssued}
        where year = ${year} and not exists (
          select 1 from transactions where receipt_no like ${`KW/${year}/%`}
            and substring(receipt_no from 9)::int > last_seq - ${receiptsIssued})`;
    }
  });

  it("signature salah → 401, event rejected, status tetap, Midtrans tidak dipanggil", async () => {
    const { paymentId, midTrxId } = await newPayment();
    setApi(paymentId, midTrxId, "settlement");
    fetchMock.mockClear();
    const r = await post(
      notification(paymentId, midTrxId, "settlement", { key: "SB-Mid-server-WRONG" }),
    );
    expect(r.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await paymentStatus(paymentId)).toBe("pending");
    expect(onRejectedSignature).toHaveBeenCalledTimes(1);
    // Tidak ada baris yang ditulis untuk signature salah.
    expect(await events(paymentId)).toHaveLength(0);
  });

  it("payload sama 5× paralel → total +1, satu publish, satu event processed + 4 duplikat", async () => {
    publishPaid.mockClear();
    revalidateCampaign.mockClear();
    const before = await campaign();
    const { txId, paymentId, midTrxId } = await newPayment();
    setApi(paymentId, midTrxId, "settlement");
    const body = notification(paymentId, midTrxId, "settlement");
    const results = await Promise.all(Array.from({ length: 5 }, () => post(body)));
    receiptsIssued += 1;

    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(results.filter((r) => r.body.result === "processed")).toHaveLength(1);
    expect(results.filter((r) => r.body.result === "duplicate")).toHaveLength(4);
    const after = await campaign();
    expect(BigInt(after.c) - BigInt(before.c)).toBe(AMOUNT);
    expect(after.n - before.n).toBe(1);
    expect(publishPaid).toHaveBeenCalledTimes(1);
    expect(publishPaid.mock.calls[0]![0]).toEqual({
      event: "payment.paid",
      transactionId: txId,
      paymentId,
    });
    expect(revalidateCampaign).toHaveBeenCalledWith(campaignId, expect.anything());
    const ev = await events(paymentId);
    expect(ev.filter((e) => e.result === "processed")).toHaveLength(1);
    expect(ev.filter((e) => e.result === "duplicate")).toHaveLength(4);
    expect(ev.find((e) => e.result === "processed")!.provider_event_id).toBe(
      `${midTrxId}:settlement:200`,
    );
    // Outbox: penanda notification.pending tepat satu, ter-commit bersama status paid.
    const outbox = await sql`select metadata from audit_logs
      where action = 'notification.pending' and entity_id = ${txId}`;
    expect(outbox).toEqual([{ metadata: { event: "payment.paid", paymentId } }]);

    // Retry Midtrans setelah sukses → 200 duplicate, tanpa publish baru.
    const again = await post(body);
    expect(again).toMatchObject({ status: 200, body: { result: "duplicate" } });
    expect(publishPaid).toHaveBeenCalledTimes(1);
  });

  it("settlement setelah expire → ignored + alert needs_review, total tidak bertambah", async () => {
    publishPaid.mockClear();
    const before = await campaign();
    const { paymentId, midTrxId } = await newPayment("expired");
    setApi(paymentId, midTrxId, "settlement");
    const r = await post(notification(paymentId, midTrxId, "settlement"));
    expect(r).toMatchObject({ status: 200, body: { result: "ignored_transition" } });
    expect(await paymentStatus(paymentId)).toBe("expired");
    expect(await campaign()).toEqual(before);
    expect(publishPaid).not.toHaveBeenCalled();
    const audit =
      await sql`select action from audit_logs where entity_type = 'payment' and entity_id = ${paymentId}`;
    expect(audit.map((a) => a.action)).toContain("payment.needs_review");
  });

  it("nominal API ≠ payment → amount_mismatch, tidak paid", async () => {
    const before = await campaign();
    const { paymentId, midTrxId } = await newPayment();
    setApi(paymentId, midTrxId, "settlement", "6000.00");
    const r = await post(notification(paymentId, midTrxId, "settlement", { gross: "6000.00" }));
    expect(r).toMatchObject({ status: 200, body: { result: "amount_mismatch" } });
    expect(await paymentStatus(paymentId)).toBe("pending");
    expect(await campaign()).toEqual(before);
    expect((await events(paymentId))[0]).toMatchObject({
      result: "amount_mismatch",
      verification: "verified",
    });
  });

  it("order tak dikenal (tes dashboard, Get Status 404) → 200, event tersimpan", async () => {
    const orderId = `payment_notif_test_G000000000_${randomBytes(4).toString("hex")}`;
    orderIds.push(orderId);
    const r = await post(notification(orderId, randomUUID(), "settlement"));
    expect(r).toMatchObject({ status: 200, body: { result: "unknown_payment" } });
    expect(await events(orderId)).toMatchObject([
      { verification: "verified", result: "unknown_payment" },
    ]);
  });

  it("refund dari webhook → tidak diterapkan, alert refund_reported (audit)", async () => {
    const { paymentId, midTrxId } = await newPayment();
    setApi(paymentId, midTrxId, "settlement");
    expect((await post(notification(paymentId, midTrxId, "settlement"))).body.result).toBe(
      "processed",
    );
    receiptsIssued += 1;
    const before = await campaign();
    setApi(paymentId, midTrxId, "refund");
    const r = await post(notification(paymentId, midTrxId, "refund"));
    expect(r).toMatchObject({ status: 200, body: { result: "ignored_transition" } });
    expect(await paymentStatus(paymentId)).toBe("paid");
    expect(await campaign()).toEqual(before);
    const audit = await sql`select action, metadata->>'kind' as kind from audit_logs
      where entity_type = 'payment' and entity_id = ${paymentId}`;
    expect(audit).toContainEqual({ action: "payment.needs_review", kind: "refund_reported" });
  });

  it("Get Status 401 (server key salah) → 503 + payment.alert provider_auth", async () => {
    const { paymentId, midTrxId } = await newPayment();
    apiState.set(paymentId, { status_code: "401", status_message: "unauthorized" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await post(notification(paymentId, midTrxId, "settlement"));
      expect(r.status).toBe(503);
      expect(spy.mock.calls.some(([l]) => String(l).includes('"kind":"provider_auth"'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(await paymentStatus(paymentId)).toBe("pending");
  });

  it("Midtrans Get Status gangguan → 503 (Midtrans retry), status tetap", async () => {
    const { paymentId, midTrxId } = await newPayment();
    apiState.set(paymentId, { status_code: "503", status_message: "down" });
    const r = await post(notification(paymentId, midTrxId, "settlement"));
    expect(r.status).toBe(503);
    expect(await paymentStatus(paymentId)).toBe("pending");
    expect((await events(paymentId))[0]).toMatchObject({
      verification: "pending",
      result: "error",
    });
    // Retry setelah pulih → diproses.
    setApi(paymentId, midTrxId, "settlement");
    expect((await post(notification(paymentId, midTrxId, "settlement"))).body.result).toBe(
      "processed",
    );
    receiptsIssued += 1;
  });
});
