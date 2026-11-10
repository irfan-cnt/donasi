/**
 * Kanal WhatsApp Fonnte (P17) lewat /api/jobs/notify terhadap DB nyata (Neon `dev`). HTTP Fonnte
 * DIMOCK (fetch di-inject) — tidak ada panggilan ke api.fonnte.com. Email memakai transport palsu.
 * Semua baris uji dihapus di afterAll.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailQuotaCounter, EmailSender } from "@/lib/email/gmail";
import { newId } from "@/lib/id";
import type { JobLock } from "@/lib/jobs/job-route";
import type { WhatsappJob } from "@/lib/notifications/jobs";
import { createFonnteSender } from "@/lib/whatsapp/fonnte";
import type { NotifyConfig, NotifyDeps } from "@/server/services/notification-service";
import { createNotifyHandler } from "@/server/services/notifications/notify-handler";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const AMOUNT = 75_000n;
const VALID_SIG = "test-signature-ok";
const FAKE_TOKEN = "fonnte-test-token-SANGAT-RAHASIA-123";
const FAKE_URL = "https://fonnte.mock.test/send";

describe.skipIf(!ENABLED)("notify WhatsApp P17 (integration, Fonnte dimock)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const campaignId = newId();
  const donorId = newId();
  const txIds: string[] = [];
  const paymentIds: string[] = [];
  let providerId: string;
  let methodId: string;

  // ---- Fonnte HTTP mock ----
  type Call = { url: string; auth: string | null; body: URLSearchParams };
  const calls: Call[] = [];
  let reply: () => Response | Promise<Response> = () => ok();
  const ok = () =>
    Response.json({
      detail: "success! message in queue",
      id: ["80367170"],
      process: "pending",
      requestid: 2937124,
      status: true,
      target: ["6281234567890"],
    });
  const fail = (reason: string) => Response.json({ reason, status: false, requestid: 99 });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(input), auth: headers.get("authorization"), body: init?.body as URLSearchParams });
    return reply();
  });
  const whatsapp = createFonnteSender({ token: FAKE_TOKEN, apiUrl: FAKE_URL, fetch: fetchMock as typeof fetch });

  const sender: EmailSender = {
    async send() {
      return { messageId: `<${randomUUID()}@test>`, accepted: 1, rejected: 0, response: "250 OK" };
    },
  };
  const quota: EmailQuotaCounter = { increment: async () => 1, once: async () => true };
  const lock: JobLock = { acquire: async () => "owner", release: async () => {} };
  const config: NotifyConfig = {
    enabled: true,
    whatsappEnabled: true,
    adminEmail: "admin-it@example.test",
    dailyLimit: 1000,
    siteUrl: "https://tebar.example",
  };
  const published: WhatsappJob[] = [];
  const publishWhatsapp = vi.fn<NotifyDeps["publishWhatsapp"]>(async (job) => {
    published.push(job);
  });
  const publishAdminAlert = vi.fn<NotifyDeps["publishAdminAlert"]>(async () => {});
  let setting = true;
  const handler = (over: Partial<NotifyConfig> = {}) =>
    createNotifyHandler({
      sender,
      quota,
      config: { ...config, ...over },
      publishAdminAlert,
      publishWhatsapp,
      whatsapp,
      whatsappSetting: async () => setting,
      lock,
      verify: async (sig) => sig === VALID_SIG,
    });
  const post = async (job: unknown, h = handler()) => {
    const r = await h(
      new Request("http://localhost:3000/api/jobs/notify", {
        method: "POST",
        headers: { "content-type": "application/json", "upstash-signature": VALID_SIG },
        body: JSON.stringify(job),
      }),
    );
    return { status: r.status, json: (await r.json()) as Record<string, unknown> };
  };

  const code = () =>
    `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").padEnd(6, "A").slice(0, 6)}`;

  async function newTx(opts: { status?: string; optIn?: boolean; phone?: string | null } = {}) {
    const id = newId();
    const phone = opts.phone === undefined ? "+6281234567890" : opts.phone;
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id,
        amount, status, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, donor_phone_snapshot,
        whatsapp_opt_in, paid_at)
      values (${id}, ${code()}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${donorId},
        ${AMOUNT.toString()}, ${opts.status ?? "pending"}, 'Campaign uji WA', 'Uji WA',
        ${`it-wa+${donorId}@example.test`}, ${phone}, ${opts.optIn ?? true},
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
  const waRow = async (txId: string) =>
    (
      (await sql`select status, attempt, dedup_key, error_message, request_payload, provider_response, recipient
        from notification_logs where transaction_id = ${txId} and channel = 'whatsapp'`) as {
        status: string;
        attempt: number;
        dedup_key: string;
        error_message: string | null;
        request_payload: Record<string, string> | null;
        provider_response: Record<string, unknown> | null;
        recipient: string;
      }[]
    )[0];
  const statuses = async (txId: string, payId: string) =>
    (await sql`select t.status as t, p.status as p, t.updated_at as tu, p.updated_at as pu
      from transactions t join payments p on p.transaction_id = t.id where t.id = ${txId} and p.id = ${payId}`)[0];

  /** Jalankan job asal lalu job whatsapp.send yang dipublish (seperti QStash). */
  async function runPaid(tx: string, pay: string) {
    const first = await post({ event: "payment.paid", transactionId: tx, paymentId: pay });
    const job = published.at(-1);
    return { first, job };
  }

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] = await sql`select m.id, m.provider_id from payment_methods m join payment_providers p
      on p.id = m.provider_id where p.code = 'midtrans' and m.type = 'virtual_account' limit 1`;
    const tpl = await sql`select event from notification_templates where is_active and channel = 'whatsapp'`;
    if (!cat || !m || tpl.length < 3) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji WA', ${`it-wa-${campaignId}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it-wa+${donorId}@example.test`}, 'Uji')`;
  });

  afterAll(async () => {
    await sql`delete from notification_logs where transaction_id = any(${txIds}::uuid[])`;
    await sql`delete from audit_logs where entity_id = any(${[...txIds, ...paymentIds]}::text[])`;
    if (paymentIds.length) await sql`delete from payments where id = any(${paymentIds}::uuid[])`;
    if (txIds.length) await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from campaigns where id = ${campaignId}`;
  });

  beforeEach(() => {
    reply = () => ok();
    setting = true;
    publishAdminAlert.mockClear();
    publishWhatsapp.mockClear();
  });

  it("sukses: job asal → WA queued + publish whatsapp.send; job kirim → Fonnte dipanggil, log sent tanpa token", async () => {
    const tx = await newTx({ status: "paid" });
    const pay = await newPay(tx, "paid");
    const before = calls.length;
    const { first, job } = await runPaid(tx, pay);
    expect(first).toMatchObject({ status: 200, json: { email: "sent", whatsapp: "queued" } });
    expect(job).toEqual({ event: "whatsapp.send", source: "payment.paid", transactionId: tx, paymentId: pay });
    expect(calls.length).toBe(before); // email tidak menunggu WA; WA belum dikirim
    expect((await waRow(tx))!.status).toBe("queued");

    const send = await post(job);
    expect(send).toMatchObject({ status: 200, json: { whatsapp: "sent" } });
    const call = calls.at(-1)!;
    expect(call.url).toBe(FAKE_URL);
    expect(call.auth).toBe(FAKE_TOKEN);
    expect(call.body.get("target")).toBe("6281234567890");
    expect(call.body.get("countryCode")).toBe("0");
    expect(call.body.get("message")).toMatch(/^Alhamdulillah, Uji WA\. Donasi Rp\s?75\.000 untuk Campaign uji WA/);
    const row = (await waRow(tx))!;
    expect(row).toMatchObject({ status: "sent", attempt: 1, dedup_key: `payment.paid:${tx}:whatsapp`, error_message: null });
    expect(row.provider_response).toMatchObject({ requestid: 2937124, id: ["80367170"], process: "pending" });
    expect(JSON.stringify(row)).not.toContain(FAKE_TOKEN);
  });

  it("payment.pending: pesan berisi payment_url tanpa access token", async () => {
    const tx = await newTx();
    const pay = await newPay(tx, "pending");
    await post({ event: "payment.pending", transactionId: tx, paymentId: pay });
    const job = published.at(-1)!;
    expect(job.source).toBe("payment.pending");
    await post(job);
    const msg = calls.at(-1)!.body.get("message")!;
    expect(msg).toMatch(/https:\/\/tebar\.example\/transaksi\/TK-[^/\s]+\/menunggu$/);
    expect(msg).not.toMatch(/[?&]t=/);
    expect((await waRow(tx))!.dedup_key).toBe(`payment.pending:${tx}:${pay}:whatsapp`);
  });

  it("dedup: job whatsapp.send ganda → satu pesan; job asal ulang tidak publish lagi setelah sent", async () => {
    const tx = await newTx({ status: "paid" });
    const pay = await newPay(tx, "paid");
    const { job } = await runPaid(tx, pay);
    const before = calls.length;
    expect((await post(job)).json).toMatchObject({ whatsapp: "sent" });
    expect((await post(job)).json).toMatchObject({ whatsapp: "duplicate" });
    expect(calls.length - before).toBe(1);
    publishWhatsapp.mockClear();
    expect((await post({ event: "payment.paid", transactionId: tx, paymentId: pay })).json).toMatchObject({
      email: "duplicate",
      whatsapp: "duplicate",
    });
    expect(publishWhatsapp).not.toHaveBeenCalled();
  });

  describe("gate → skipped dengan alasan, tanpa panggilan Fonnte", () => {
    const cases: [string, () => Promise<{ tx: string; h?: ReturnType<typeof handler> }>, RegExp | null][] = [
      ["tanpa opt-in → tidak ada baris WA", async () => ({ tx: await newTx({ status: "paid", optIn: false }) }), null],
      ["WHATSAPP_ENABLED=false", async () => ({ tx: await newTx({ status: "paid" }), h: handler({ whatsappEnabled: false }) }), /WHATSAPP_ENABLED=false/],
      ["NOTIFICATIONS_ENABLED=false", async () => ({ tx: await newTx({ status: "paid" }), h: handler({ enabled: false }) }), /NOTIFICATIONS_ENABLED=false/],
      [
        "platform_settings whatsapp_enabled=false",
        async () => {
          setting = false;
          return { tx: await newTx({ status: "paid" }) };
        },
        /notifications\.whatsapp_enabled=false/,
      ],
      ["nomor kosong", async () => ({ tx: await newTx({ status: "paid", phone: null }) }), /nomor WhatsApp kosong/],
      ["nomor tidak valid", async () => ({ tx: await newTx({ status: "paid", phone: "+1555123" }) }), /nomor WhatsApp tidak valid/],
    ];
    for (const [name, setup, reason] of cases) {
      it(name, async () => {
        const { tx, h } = await setup();
        const pay = await newPay(tx, "paid");
        const before = calls.length;
        const r = await post({ event: "payment.paid", transactionId: tx, paymentId: pay }, h);
        expect(r.status).toBe(200);
        expect(publishWhatsapp).not.toHaveBeenCalled();
        expect(calls.length).toBe(before);
        const row = await waRow(tx);
        if (!reason) {
          expect(row).toBeUndefined();
          expect(r.json.whatsapp).toBeUndefined();
        } else {
          expect(row!.status).toBe("skipped");
          expect(row!.error_message).toMatch(reason);
        }
      });
    }

    it("gate dicek ulang saat job kirim (setting dimatikan setelah antre) → skipped", async () => {
      const tx = await newTx({ status: "paid" });
      const pay = await newPay(tx, "paid");
      const { job } = await runPaid(tx, pay);
      setting = false;
      const before = calls.length;
      expect((await post(job)).json).toMatchObject({ whatsapp: "skipped" });
      expect(calls.length).toBe(before);
      expect((await waRow(tx))!.status).toBe("skipped");
    });
  });

  describe("pemetaan error Fonnte; status pembayaran tidak berubah (BR-31)", () => {
    const cases = [
      ["token invalid", "fonnte:invalid_token", true],
      ["disconnected device", "fonnte:device_disconnected", true],
      ["target invalid", "fonnte:invalid_target", false],
      ["insufficient quota", "fonnte:quota_exceeded", false],
    ] as const;
    for (const [reason, code, alert] of cases) {
      it(`${reason} → failed ${code}, tanpa retry${alert ? ", alert admin" : ""}`, async () => {
        const tx = await newTx({ status: "paid" });
        const pay = await newPay(tx, "paid");
        const snap = await statuses(tx, pay);
        const { job } = await runPaid(tx, pay);
        reply = () => fail(reason);
        const r = await post(job);
        expect(r).toMatchObject({ status: 200, json: { whatsapp: "failed" } });
        const row = (await waRow(tx))!;
        expect(row).toMatchObject({ status: "failed", attempt: 1, error_message: code });
        expect(row.provider_response).toMatchObject({ reason, requestid: 99 });
        expect(JSON.stringify(row)).not.toContain(FAKE_TOKEN);
        if (alert) {
          expect(publishAdminAlert).toHaveBeenCalledWith(
            expect.objectContaining({ event: "admin.alert", kind: "whatsapp", alert: code.slice(7) }),
            expect.anything(),
          );
        } else {
          expect(publishAdminAlert).not.toHaveBeenCalled();
        }
        expect(await statuses(tx, pay)).toEqual(snap);
      });
    }

    it("HTTP 5xx → failed + 500 (QStash retry); retry berikutnya sent (attempt 2)", async () => {
      const tx = await newTx({ status: "paid" });
      const pay = await newPay(tx, "paid");
      const snap = await statuses(tx, pay);
      const { job } = await runPaid(tx, pay);
      reply = () => new Response("bad gateway", { status: 502 });
      expect((await post(job)).status).toBe(500);
      expect(await waRow(tx)).toMatchObject({ status: "failed", attempt: 1, error_message: "fonnte:http_error" });
      reply = () => ok();
      expect((await post(job)).json).toMatchObject({ whatsapp: "sent" });
      expect(await waRow(tx)).toMatchObject({ status: "sent", attempt: 2 });
      expect(await statuses(tx, pay)).toEqual(snap);
    });

    it("publish job WA gagal → baris tetap queued, job asal 500 (retry), email tidak terkirim dua kali", async () => {
      const tx = await newTx({ status: "paid" });
      const pay = await newPay(tx, "paid");
      publishWhatsapp.mockRejectedValueOnce(new Error("qstash down"));
      const r1 = await post({ event: "payment.paid", transactionId: tx, paymentId: pay });
      expect(r1.status).toBe(500);
      expect((await waRow(tx))!.status).toBe("queued");
      const r2 = await post({ event: "payment.paid", transactionId: tx, paymentId: pay });
      expect(r2).toMatchObject({ status: 200, json: { email: "duplicate", whatsapp: "queued" } });
    });
  });

  it("token tidak pernah muncul di log aplikasi", async () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    try {
      const tx = await newTx({ status: "paid" });
      const pay = await newPay(tx, "paid");
      const { job } = await runPaid(tx, pay);
      reply = () => fail("token invalid");
      await post(job);
      const out = spies.flatMap((s) => s.mock.calls.flat()).map(String).join("\n");
      expect(out).toContain("whatsapp: kirim gagal");
      expect(out).not.toContain(FAKE_TOKEN);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
