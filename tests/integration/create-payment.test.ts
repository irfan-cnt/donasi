/**
 * createPaymentForTransaction (P11, T-25) terhadap DB nyata (branch Neon `dev`) dengan FakeProvider.
 * Membuat campaign/donor/transaksi/metode uji sendiri dan menghapusnya di afterAll; baris seed
 * hanya dibaca. Prasyarat: provider `midtrans` is_enabled=true di branch dev.
 */
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createLogger } from "@/lib/logger";
import { createMidtransProvider, MidtransError } from "@/lib/payments/midtrans";
import { recordMidtransEvent } from "@/lib/payments/midtrans/event-log";
import type { PaymentProvider } from "@/lib/payments/types";
import { acquireLock, releaseLock } from "@/lib/redis";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import {
  createPaymentForTransaction,
  type CreatePaymentDeps,
  type PaymentPendingJob,
} from "@/server/services/payment-service";
import { FakeProvider } from "../support/fake-payment-provider";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const AMOUNT = 80_000n;

describe.skipIf(!ENABLED)("createPayment (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const log = createLogger({ test: "create-payment" });
  const suffix = randomBytes(4).toString("hex");
  const campaignId = newId();
  const slug = `it-cp-${suffix}`;
  const donorId = newId();
  const methodA = `it_va_a_${suffix}`;
  const methodB = `it_va_b_${suffix}`;
  const methodSmall = `it_va_small_${suffix}`;
  const methodIds: string[] = [];
  const txIds: string[] = [];
  let provider: FakeProvider;
  let jobs: PaymentPendingJob[];

  const deps = (over: Partial<CreatePaymentDeps> = {}): CreatePaymentDeps => ({
    getProvider: () => provider,
    acquireLock,
    releaseLock,
    enqueuePaymentPending: async (job) => {
      jobs.push(job);
    },
    now: () => new Date(),
    ...over,
  });

  async function newTransaction(status: "created" | "paid" = "created") {
    const id = newId();
    const token = generateSessionToken();
    const code = `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").slice(0, 6)}`;
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id,
        amount, status, paid_at, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot)
      values (${id}, ${code}, ${sha256(token)}, now() + interval '1 day', ${campaignId}, ${donorId},
        ${AMOUNT.toString()}, ${status}, ${status === "paid" ? new Date() : null}, 'Campaign uji createPayment', 'Uji',
        ${`it+${donorId}@example.test`})`;
    txIds.push(id);
    return { id, code, token };
  }

  const input = (t: { code: string; token: string }, method = methodA) => ({
    slug,
    trx: t.code,
    t: t.token,
    method,
  });

  const paymentsOf = async (txId: string) =>
    (await sql`select p.id, p.status, p.provider_ref, p.instruction, p.expires_at, m.code as method
      from payments p join payment_methods m on m.id = p.payment_method_id
      where p.transaction_id = ${txId} order by p.created_at, p.id`) as {
      id: string;
      status: string;
      provider_ref: string | null;
      instruction: unknown;
      expires_at: Date | null;
      method: string;
    }[];
  const txStatus = async (txId: string) =>
    ((await sql`select status from transactions where id = ${txId}`)[0] as { status: string }).status;

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [p] = await sql`select id, is_enabled from payment_providers where code = 'midtrans'`;
    if (!cat || !p) throw new Error("reference seed belum ada (pnpm db:seed)");
    if (!p.is_enabled) throw new Error("provider midtrans belum di-enable di branch dev");
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji createPayment', ${slug}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it+${donorId}@example.test`}, 'Uji')`;
    for (const [code, max] of [
      [methodA, null],
      [methodB, null],
      [methodSmall, "50000"],
    ] as const) {
      const id = newId();
      methodIds.push(id);
      await sql`insert into payment_methods (id, provider_id, code, provider_channel, type, display_name, max_amount, is_active, display_order)
        values (${id}, ${p.id}, ${code}, 'bca', 'virtual_account', ${`Uji ${code}`}, ${max}, true, 999)`;
    }
  });

  beforeEach(() => {
    provider = new FakeProvider();
    jobs = [];
  });

  afterAll(async () => {
    if (txIds.length) {
      await sql`delete from payment_events where payment_id in (select id from payments where transaction_id = any(${txIds}::uuid[]))`;
      await sql`delete from payments where transaction_id = any(${txIds}::uuid[])`;
      await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    }
    if (methodIds.length) await sql`delete from payment_methods where id = any(${methodIds}::uuid[])`;
    await sql`delete from audit_logs where action = 'payment.orphan_charge' and metadata->>'transactionId' = any(${txIds}::text[])`;
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from campaigns where id = ${campaignId}`;
  });

  it("membuat payment pending (id UUIDv7 = order_id) + instruksi + enqueue payment.pending", async () => {
    const t = await newTransaction();
    const r = await createPaymentForTransaction(input(t), log, deps());
    expect(r).toMatchObject({ ok: true, code: t.code, reused: false });
    const rows = await paymentsOf(t.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", method: methodA, provider_ref: `fake-${rows[0]!.id}` });
    expect(rows[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(rows[0]!.instruction).toMatchObject({ kind: "virtual_account", vaNumber: "0000000000" });
    expect(rows[0]!.expires_at).not.toBeNull();
    expect(await txStatus(t.id)).toBe("pending");
    expect(jobs).toEqual([{ event: "payment.pending", transactionId: t.id, paymentId: rows[0]!.id }]);
  });

  it("metode sama dipilih ulang → payment pending dipakai ulang (tanpa charge baru)", async () => {
    const t = await newTransaction();
    const first = await createPaymentForTransaction(input(t), log, deps());
    const again = await createPaymentForTransaction(input(t), log, deps());
    expect(again).toMatchObject({ ok: true, reused: true });
    expect(first.ok && again.ok && again.paymentId === first.paymentId).toBe(true);
    expect(provider.calls.create).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    expect(await paymentsOf(t.id)).toHaveLength(1);
  });

  it("ganti metode → payment lama di-expire ke provider lalu cancelled; transaksi tetap pending", async () => {
    const t = await newTransaction();
    await createPaymentForTransaction(input(t, methodA), log, deps());
    const [old] = await paymentsOf(t.id);
    const r = await createPaymentForTransaction(input(t, methodB), log, deps());
    expect(r).toMatchObject({ ok: true, reused: false });
    expect(provider.calls.expire).toEqual([old!.id]);
    const rows = await paymentsOf(t.id);
    expect(rows.map((p) => [p.method, p.status])).toEqual([
      [methodA, "cancelled"],
      [methodB, "pending"],
    ]);
    expect(await txStatus(t.id)).toBe("pending");
  });

  it("klik ganda (paralel) → hanya satu payment aktif & satu charge", async () => {
    const t = await newTransaction();
    const results = await Promise.all([
      createPaymentForTransaction(input(t), log, deps()),
      createPaymentForTransaction(input(t), log, deps()),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ reason: "in_progress", retryable: true });
    expect(provider.calls.create).toHaveLength(1);
    expect((await paymentsOf(t.id)).filter((p) => p.status === "pending")).toHaveLength(1);
  });

  it("lock dilewati → constraint DB satu-aktif tetap menjaga; charge kedua di-expire", async () => {
    const t = await newTransaction();
    const noLock = deps({ acquireLock: async () => newId(), releaseLock: async () => {} });
    const results = await Promise.all([
      createPaymentForTransaction(input(t), log, noLock),
      createPaymentForTransaction(input(t), log, noLock),
    ]);
    const rows = await paymentsOf(t.id);
    expect(rows.filter((p) => p.status === "pending")).toHaveLength(1);
    expect(results.filter((r) => r.ok).length).toBeGreaterThanOrEqual(1);
    // Charge yang kalah (bila keduanya sempat charge) di-expire & barisnya failed.
    const losers = rows.filter((p) => p.status === "failed").map((p) => p.id);
    for (const id of losers) {
      if (provider.calls.create.includes(id)) expect(provider.calls.expire).toContain(id);
    }
  });

  it("error provider → pesan ramah, payment failed, transaksi tetap created & bisa dicoba lagi", async () => {
    const t = await newTransaction();
    provider.failNextCreate = new MidtransError("timeout", "POST /v2/charge");
    const r = await createPaymentForTransaction(input(t), log, deps());
    expect(r).toEqual({
      ok: false,
      reason: "provider_error",
      message: "Layanan pembayaran tidak merespons. Silakan coba lagi beberapa saat lagi.",
      retryable: true,
    });
    expect((await paymentsOf(t.id)).map((p) => p.status)).toEqual(["failed"]);
    expect(await txStatus(t.id)).toBe("created");
    expect(jobs).toHaveLength(0);

    const retry = await createPaymentForTransaction(input(t), log, deps());
    expect(retry).toMatchObject({ ok: true });
    expect((await paymentsOf(t.id)).map((p) => p.status)).toEqual(["failed", "pending"]);
    expect(await txStatus(t.id)).toBe("pending");
  });

  it("error provider saat ganti metode → lama cancelled, transaksi tidak pernah cancelled, retry OK", async () => {
    const t = await newTransaction();
    await createPaymentForTransaction(input(t, methodA), log, deps());
    provider.failNextCreate = new MidtransError("provider_unavailable", "500", "500");
    const r = await createPaymentForTransaction(input(t, methodB), log, deps());
    expect(r).toMatchObject({ ok: false, reason: "provider_error", retryable: true });
    expect((await paymentsOf(t.id)).map((p) => p.status)).toEqual(["cancelled", "failed"]);
    expect(await txStatus(t.id)).toBe("pending");
    const retry = await createPaymentForTransaction(input(t, methodB), log, deps());
    expect(retry).toMatchObject({ ok: true, reused: false });
    expect(await txStatus(t.id)).toBe("pending");
  });

  it("error jaringan Midtrans tercatat di payment_events (create_error) dan transaksi bisa dicoba lagi", async () => {
    const t = await newTransaction();
    const midtrans: PaymentProvider = createMidtransProvider({
      serverKey: "SB-Mid-server-integration-test",
      isProduction: false,
      recordEvent: recordMidtransEvent,
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    const r = await createPaymentForTransaction(input(t), log, deps({ getProvider: () => midtrans }));
    expect(r).toMatchObject({ ok: false, reason: "provider_error", retryable: true });
    const [p] = await paymentsOf(t.id);
    expect(p!.status).toBe("failed");
    const events = await sql`select event_type, result from payment_events where payment_id = ${p!.id}`;
    expect(events.map((e) => e.event_type)).toContain("create_error");
    expect(await txStatus(t.id)).toBe("created");
  });

  it("token salah / slug salah → not_found; transaksi paid → not_payable; nominal > max metode → method_unavailable", async () => {
    const t = await newTransaction();
    const wrong = generateSessionToken();
    expect(await createPaymentForTransaction({ ...input(t), t: wrong }, log, deps())).toMatchObject({
      ok: false,
      reason: "not_found",
    });
    expect(
      await createPaymentForTransaction({ ...input(t), slug: "slug-lain" }, log, deps()),
    ).toMatchObject({ ok: false, reason: "not_found" });
    expect(await createPaymentForTransaction(input(t, methodSmall), log, deps())).toMatchObject({
      ok: false,
      reason: "method_unavailable",
    });
    expect(await createPaymentForTransaction({ ...input(t), method: "BAD CODE" }, log, deps())).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    const paid = await newTransaction("paid");
    expect(await createPaymentForTransaction(input(paid), log, deps())).toMatchObject({
      ok: false,
      reason: "not_payable",
    });
    expect(provider.calls.create).toHaveLength(0);
  });

  it("aktivasi gagal setelah ganti metode → payment lama cancelled; pilih ulang metode lama = charge baru", async () => {
    const other = await newTransaction();
    await createPaymentForTransaction(input(other, methodA), log, deps());
    const [taken] = await paymentsOf(other.id);

    const t = await newTransaction();
    await createPaymentForTransaction(input(t, methodA), log, deps());
    const [old] = await paymentsOf(t.id);
    provider.nextProviderRef = taken!.provider_ref; // bentrok payments_provider_ref_key saat aktivasi
    const r = await createPaymentForTransaction(input(t, methodB), log, deps());
    expect(r).toMatchObject({ ok: false });
    const rows = await paymentsOf(t.id);
    expect(rows.map((p) => p.status)).toEqual(["cancelled", "failed"]);
    expect(await txStatus(t.id)).toBe("pending");

    const createsBefore = provider.calls.create.length;
    const again = await createPaymentForTransaction(input(t, methodA), log, deps());
    expect(again).toMatchObject({ ok: true, reused: false });
    expect(again.ok && again.paymentId).not.toBe(old!.id);
    expect(provider.calls.create.length).toBe(createsBefore + 1);
  });

  it("charge yatim yang gagal di-expire → log + audit payment.orphan_charge, baris failed", async () => {
    const other = await newTransaction();
    await createPaymentForTransaction(input(other, methodA), log, deps());
    const [taken] = await paymentsOf(other.id);
    const t = await newTransaction();
    provider.nextProviderRef = taken!.provider_ref;
    // Expire charge baru (order_id belum diketahui) selalu gagal.
    const origExpire = provider.expirePayment.bind(provider);
    provider.expirePayment = async (ref) => {
      if (ref.orderId !== taken!.id) throw new Error("fake: expire gagal");
      return origExpire(ref);
    };
    const r = await createPaymentForTransaction(input(t, methodA), log, deps());
    expect(r).toMatchObject({ ok: false });
    const [p] = await paymentsOf(t.id);
    expect(p!.status).toBe("failed");
    const audits = await sql`select metadata from audit_logs where action = 'payment.orphan_charge' and entity_id = ${p!.id}`;
    expect(audits).toHaveLength(1);
    expect(audits[0]!.metadata).toMatchObject({ paymentId: p!.id, transactionId: t.id, cause: "activation_failed" });
  });
});
