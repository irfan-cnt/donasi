/**
 * Handler /api/jobs/notify (P16) terhadap DB nyata (Neon `dev`) dengan transport email palsu
 * (tanpa SMTP), verifier signature QStash di-inject, lock & kuota in-memory. Semua baris uji
 * dihapus di afterAll.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { EmailMessage, EmailQuotaCounter, EmailSender } from "@/lib/email/gmail";
import { newId } from "@/lib/id";
import type { JobLock } from "@/lib/jobs/job-route";
import { createLogger } from "@/lib/logger";
import type { NotifyJob } from "@/lib/notifications/jobs";
import type { JobServiceDeps } from "@/server/services/jobs/job-deps";
import { drainNotificationOutbox } from "@/server/services/jobs/reconcile";
import type { NotifyConfig, NotifyDeps } from "@/server/services/notification-service";
type NotifyDepsAlert = NotifyDeps["publishAdminAlert"];
import { createNotifyHandler } from "@/server/services/notifications/notify-handler";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const AMOUNT = 50_000n;
const VALID_SIG = "test-signature-ok";

describe.skipIf(!ENABLED)("notify P16 (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const campaignId = newId();
  const donorId = newId();
  const txIds: string[] = [];
  const paymentIds: string[] = [];
  const alertRef = `it-${randomBytes(4).toString("hex")}`;
  let providerId: string;
  let methodId: string;

  // ---- fakes ----
  const sent: EmailMessage[] = [];
  let failNext = 0;
  const sender: EmailSender = {
    async send(m) {
      if (failNext > 0) {
        failNext -= 1;
        throw Object.assign(new Error("Invalid login: 535 secret detail"), { code: "EAUTH", responseCode: 535 });
      }
      sent.push(m);
      return { messageId: `<${randomUUID()}@test>`, accepted: 1, rejected: 0, response: "250 OK" };
    },
  };
  const counts = new Map<string, number>();
  const onceKeys = new Set<string>();
  const quota: EmailQuotaCounter = {
    async increment(d) {
      counts.set(d, (counts.get(d) ?? 0) + 1);
      return counts.get(d)!;
    },
    async once(k) {
      if (onceKeys.has(k)) return false;
      onceKeys.add(k);
      return true;
    },
  };
  const held = new Set<string>();
  const lock: JobLock = {
    async acquire(name) {
      if (held.has(name)) return null;
      held.add(name);
      return "owner";
    },
    async release(name) {
      held.delete(name);
    },
  };
  const config: NotifyConfig = {
    enabled: true,
    whatsappEnabled: false,
    adminEmail: "admin-it@example.test",
    dailyLimit: 1000,
    siteUrl: "https://tebar.example",
  };
  const publishAdminAlert = vi.fn<NotifyDepsAlert>(async () => {});
  const handler = (over: Partial<NotifyConfig> = {}) =>
    createNotifyHandler({
      sender,
      quota,
      config: { ...config, ...over },
      publishAdminAlert,
      lock,
      verify: async (sig) => sig === VALID_SIG,
      publishReceipt: async () => {}, // P19: jangan publish ke QStash sungguhan
    });
  const post = (job: unknown, sig = VALID_SIG, h = handler()) =>
    h(
      new Request("http://localhost:3000/api/jobs/notify", {
        method: "POST",
        headers: { "content-type": "application/json", "upstash-signature": sig },
        body: JSON.stringify(job),
      }),
    );

  const code = () =>
    `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").padEnd(6, "A").slice(0, 6)}`;

  async function newTx(opts: { status?: string; optIn?: boolean; name?: string } = {}) {
    const id = newId();
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id,
        amount, status, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, donor_phone_snapshot,
        whatsapp_opt_in, paid_at)
      values (${id}, ${code()}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${donorId},
        ${AMOUNT.toString()}, ${opts.status ?? "pending"}, 'Campaign uji notifikasi', ${opts.name ?? "Uji Donatur"},
        ${`it+${donorId}@example.test`}, '081234567890', ${opts.optIn ?? false},
        ${opts.status === "paid" ? new Date() : null})`;
    txIds.push(id);
    return id;
  }
  async function newPay(txId: string, status: string) {
    const id = newId();
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, provider_ref, amount, status,
        instruction, expires_at, paid_at)
      values (${id}, ${txId}, ${methodId}, ${providerId}, ${randomUUID()}, ${AMOUNT.toString()}, ${status},
        ${JSON.stringify({ kind: "virtual_account", bankName: "bca", vaNumber: "1234567890123" })}::jsonb,
        now() + interval '1 day', ${status === "paid" ? new Date() : null})`;
    paymentIds.push(id);
    return id;
  }
  const logs = async (txId: string) =>
    (await sql`select channel, status, attempt, dedup_key, error_message, request_payload, provider_response
      from notification_logs where transaction_id = ${txId} order by channel`) as {
      channel: string;
      status: string;
      attempt: number;
      dedup_key: string;
      error_message: string | null;
      request_payload: Record<string, string> | null;
      provider_response: Record<string, unknown> | null;
    }[];
  const statuses = async (txId: string, payId: string) =>
    (await sql`select t.status as t, p.status as p, t.updated_at as tu, p.updated_at as pu
      from transactions t join payments p on p.transaction_id = t.id where t.id = ${txId} and p.id = ${payId}`)[0];

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] = await sql`select m.id, m.provider_id from payment_methods m join payment_providers p
      on p.id = m.provider_id where p.code = 'midtrans' and m.type = 'virtual_account' limit 1`;
    const tpl = await sql`select event from notification_templates where is_active and channel = 'email'`;
    if (!cat || !m || tpl.length < 4) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji notifikasi', ${`it-notify-${campaignId}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it+${donorId}@example.test`}, 'Uji')`;
  });

  afterAll(async () => {
    await sql`delete from notification_logs where transaction_id = any(${txIds}::uuid[]) or dedup_key like ${`admin.alert:%${alertRef}%`}`;
    await sql`delete from audit_logs where entity_id = any(${[...txIds, ...paymentIds]}::text[])`;
    if (paymentIds.length) await sql`delete from payments where id = any(${paymentIds}::uuid[])`;
    if (txIds.length) await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from campaigns where id = ${campaignId}`;
  });

  it("tanpa signature valid → 401, tidak ada log", async () => {
    const tx = await newTx();
    const pay = await newPay(tx, "pending");
    const r = await post({ event: "payment.pending", transactionId: tx, paymentId: pay }, "bad");
    expect(r.status).toBe(401);
    expect(await logs(tx)).toHaveLength(0);
  });

  it("payment.pending: email terkirim dengan instruksi, escaping, payload tanpa token; WA opt-in → skipped", async () => {
    const tx = await newTx({ optIn: true, name: `<b>Ani</b>` });
    const pay = await newPay(tx, "pending");
    const before = sent.length;
    const r = await post({ event: "payment.pending", transactionId: tx, paymentId: pay });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, email: "sent", whatsapp: "skipped" });
    const mail = sent[before]!;
    expect(mail.to).toBe(`it+${donorId}@example.test`);
    expect(mail.subject).toMatch(/^Selesaikan pembayaran donasi TK-/);
    expect(mail.text).toContain("1234567890123");
    expect(mail.html).toContain("&lt;b&gt;Ani&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Ani</b>");
    const rows = await logs(tx);
    expect(rows.map((x) => [x.channel, x.status])).toEqual([
      ["email", "sent"],
      ["whatsapp", "skipped"],
    ]);
    expect(rows[0]!.attempt).toBe(1);
    expect(rows[0]!.dedup_key).toBe(`payment.pending:${tx}:${pay}:email`);
    expect(rows[0]!.request_payload?.payment_url).toMatch(/\/transaksi\/TK-[^/]+\/menunggu$/);
    expect(JSON.stringify(rows)).not.toMatch(/password|APP_PASSWORD/i);
    expect(rows[1]!.error_message).toMatch(/WHATSAPP_ENABLED=false/);
  });

  it("dedup: dua job payment.paid identik → satu email", async () => {
    const tx = await newTx({ status: "paid" });
    const pay = await newPay(tx, "paid");
    const before = sent.length;
    const job = { event: "payment.paid", transactionId: tx, paymentId: pay };
    const [a, b] = [await post(job), await post(job)];
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await b.json()).toMatchObject({ email: "duplicate" });
    expect(sent.length - before).toBe(1);
    expect(await logs(tx)).toHaveLength(1); // tanpa opt-in WA → hanya email
  });

  it("job paralel identik → lock per pesan, tetap satu email", async () => {
    const tx = await newTx({ status: "paid" });
    const pay = await newPay(tx, "paid");
    const before = sent.length;
    const job = { event: "payment.paid", transactionId: tx, paymentId: pay };
    const rs = await Promise.all([post(job), post(job), post(job)]);
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(sent.length - before).toBe(1);
  });

  it("SMTP gagal → log failed + 500 (QStash retry), status pembayaran tidak berubah; retry berikutnya sent", async () => {
    const tx = await newTx({ optIn: true });
    const pay = await newPay(tx, "pending");
    await sql`update payments set status = 'failed', failure_reason = 'uji' where id = ${pay}`;
    await sql`update transactions set status = 'failed' where id = ${tx}`;
    const snap = await statuses(tx, pay);
    failNext = 1;
    const job = { event: "payment.failed", transactionId: tx, paymentId: pay };
    const r1 = await post(job);
    expect(r1.status).toBe(500);
    let rows = await logs(tx);
    expect(rows.find((x) => x.channel === "email")).toMatchObject({ status: "failed", attempt: 1 });
    expect(rows.find((x) => x.channel === "email")!.error_message).toBe("Error:EAUTH:535");
    expect(rows.find((x) => x.channel === "whatsapp")?.status).toBe("skipped");
    expect(await statuses(tx, pay)).toEqual(snap); // BR-31

    const r2 = await post(job); // retry QStash
    expect(r2.status).toBe(200);
    rows = await logs(tx);
    expect(rows.find((x) => x.channel === "email")).toMatchObject({ status: "sent", attempt: 2, error_message: null });
    expect(await statuses(tx, pay)).toEqual(snap);
  });

  it("payment.pending usang (payment sudah paid) → skipped, tanpa email", async () => {
    const tx = await newTx({ status: "paid" });
    const pay = await newPay(tx, "paid");
    const before = sent.length;
    const r = await post({ event: "payment.pending", transactionId: tx, paymentId: pay });
    expect(await r.json()).toMatchObject({ email: "skipped" });
    expect(sent.length).toBe(before);
  });

  it("NOTIFICATIONS_ENABLED=false → skipped per kanal, tanpa kirim", async () => {
    const tx = await newTx({ status: "expired" });
    const pay = await newPay(tx, "expired");
    const before = sent.length;
    const r = await post({ event: "payment.expired", transactionId: tx, paymentId: pay }, VALID_SIG, handler({ enabled: false }));
    expect(await r.json()).toMatchObject({ email: "skipped" });
    expect(sent.length).toBe(before);
    expect((await logs(tx))[0]).toMatchObject({ status: "skipped", error_message: "NOTIFICATIONS_ENABLED=false" });
  });

  it("admin.alert → email ke EMAIL_ADMIN_ALERT, dedup per ref", async () => {
    const before = sent.length;
    const job: NotifyJob = { event: "admin.alert", kind: "payment", alert: "amount_mismatch", ref: alertRef };
    expect((await post(job)).status).toBe(200);
    expect((await post(job)).status).toBe(200);
    expect(sent.length - before).toBe(1);
    expect(sent[before]!.to).toBe("admin-it@example.test");
    expect(sent[before]!.subject).toMatch(/Nominal pembayaran tidak sesuai/);
  });

  it("kuota > 80% → publish alert email_quota sekali", async () => {
    const tx = await newTx({ status: "paid" });
    const pay = await newPay(tx, "paid");
    publishAdminAlert.mockClear();
    const r = await post({ event: "payment.paid", transactionId: tx, paymentId: pay }, VALID_SIG, handler({ dailyLimit: 2 }));
    expect(r.status).toBe(200);
    expect(publishAdminAlert).toHaveBeenCalledTimes(1);
    expect(publishAdminAlert.mock.calls[0]![0]).toMatchObject({ event: "admin.alert", kind: "email_quota" });
  });

  it("body tidak valid → 200 diabaikan (tidak di-retry)", async () => {
    const r = await post({ event: "payment.paid", transactionId: "bukan-uuid" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ignored: "invalid_body" });
  });

  it("drain outbox §6a puas setelah handler menulis baris per kanal (email + WA skipped)", async () => {
    const tx = await newTx({ status: "paid", optIn: true });
    const pay = await newPay(tx, "paid");
    await sql`insert into audit_logs (actor_type, action, entity_type, entity_id, metadata, created_at)
      values ('system', 'notification.pending', 'transaction', ${tx},
        ${JSON.stringify({ event: "payment.paid", paymentId: pay })}::jsonb, now() - interval '15 minutes')`;
    const publishPaid = vi.fn<JobServiceDeps["publishPaid"]>(async () => {});
    const deps = {
      log: createLogger({ test: "notify" }),
      getProvider: () => null,
      publishPaid,
      revalidateCampaign: async () => {},
      publishAdminAlert: async () => {},
      revalidateTags: () => {},
    } satisfies JobServiceDeps;
    const scope = { campaignIds: [campaignId] };
    const pending = await drainNotificationOutbox(deps, scope);
    expect(pending.undrained).toBeGreaterThanOrEqual(1);
    expect(publishPaid).toHaveBeenCalledWith(expect.objectContaining({ transactionId: tx }), expect.anything());

    expect((await post({ event: "payment.paid", transactionId: tx, paymentId: pay })).status).toBe(200);
    publishPaid.mockClear();
    await drainNotificationOutbox(deps, scope);
    expect(publishPaid).not.toHaveBeenCalledWith(expect.objectContaining({ transactionId: tx }), expect.anything());
    expect((await logs(tx)).map((x) => x.channel)).toEqual(["email", "whatsapp"]);
  });
});
