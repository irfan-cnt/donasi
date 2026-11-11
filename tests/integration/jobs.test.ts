/**
 * Job P14 (expire, cancel-stale, reconcile, campaign-scheduler) terhadap DB nyata (Neon `dev`)
 * dengan HTTP Midtrans di-stub lewat `fetch` adapter. Job dibatasi ke campaign uji (JobScope)
 * sehingga baris seed/orang lain tidak tersentuh. Semua baris uji dihapus di afterAll.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { newId } from "@/lib/id";
import { createLogger } from "@/lib/logger";
import { createMidtransProvider } from "@/lib/payments/midtrans/provider";
import { runCampaignScheduler } from "@/server/services/jobs/campaign-scheduler";
import { runCancelStale } from "@/server/services/jobs/cancel-stale";
import { runExpirePayments } from "@/server/services/jobs/expire-payments";
import type { JobServiceDeps } from "@/server/services/jobs/job-deps";
import { runReconcile } from "@/server/services/jobs/reconcile";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const AMOUNT = 75_000n;

describe.skipIf(!ENABLED)("job P14 (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const log = createLogger({ test: "jobs" });
  const campaignId = newId();
  const endedCampaignId = newId();
  const donorId = newId();
  const scope = { campaignIds: [campaignId] };
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

  // ---- Stub Midtrans (status per order_id; expire mengubah pending → expire) ----
  const api = new Map<string, { status: string; trx: string; gross?: string }>();
  const calls = { status: [] as string[], expire: [] as string[] };
  const body = (orderId: string) => {
    const s = api.get(orderId);
    if (!s) return { status_code: "404", status_message: "Transaction doesn't exist." };
    return {
      status_code: s.status === "settlement" ? "200" : s.status === "pending" ? "201" : "407",
      order_id: orderId,
      transaction_id: s.trx,
      transaction_status: s.status,
      gross_amount: s.gross ?? `${AMOUNT}.00`,
      transaction_time: "2026-11-10 10:00:00",
      settlement_time: s.status === "settlement" ? "2026-11-10 10:05:00" : undefined,
      fraud_status: "accept",
    };
  };
  const stubImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const st = /\/v2\/([^/]+)\/status$/.exec(u);
    if (st) {
      calls.status.push(decodeURIComponent(st[1]!));
      return new Response(JSON.stringify(body(decodeURIComponent(st[1]!))), { status: 200 });
    }
    const ex = /\/v2\/([^/]+)\/expire$/.exec(u);
    if (ex && init?.method === "POST") {
      const id = decodeURIComponent(ex[1]!);
      calls.expire.push(id);
      const s = api.get(id);
      if (!s) return new Response(JSON.stringify({ status_code: "404" }), { status: 200 });
      if (s.status !== "pending") {
        return new Response(JSON.stringify({ status_code: "412" }), { status: 200 });
      }
      s.status = "expire";
      return new Response(JSON.stringify({ ...body(id), status_code: "407" }), { status: 200 });
    }
    return new Response(JSON.stringify({ status_code: "500" }), { status: 200 });
  };
  const fetchStub = vi.fn(stubImpl);
  const provider = createMidtransProvider({
    serverKey: "SB-Mid-server-JOBSITKEY01",
    isProduction: false,
    recordEvent: async () => {},
    fetch: fetchStub as unknown as typeof fetch,
    logger: log,
  });
  const deps = {
    log,
    getProvider: () => provider,
    publishPaid: vi.fn<JobServiceDeps["publishPaid"]>(async () => {}),
    revalidateCampaign: vi.fn<JobServiceDeps["revalidateCampaign"]>(async () => {}),
    publishAdminAlert: vi.fn<JobServiceDeps["publishAdminAlert"]>(async () => {}),
    revalidateTags: vi.fn<JobServiceDeps["revalidateTags"]>(),
  } satisfies JobServiceDeps;
  const far = () => Date.now() + 60_000;

  const code = () =>
    `TK-000000-${randomBytes(3)
      .toString("hex")
      .toUpperCase()
      .replace(/[ILOU]/g, "A")
      .padEnd(6, "A")
      .slice(0, 6)}`;

  async function newTx(status: string, createdAgo = "0 minutes") {
    const id = newId();
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id,
        amount, status, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, created_at, updated_at)
      values (${id}, ${code()}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${donorId},
        ${AMOUNT.toString()}, ${status}, 'Campaign uji job', 'Uji', ${`it+${donorId}@example.test`},
        now() - ${createdAgo}::interval, now() - ${createdAgo}::interval)`;
    txIds.push(id);
    return id;
  }

  async function newPay(
    txId: string,
    status: string,
    opts: { expiresAgo?: string; providerRef?: string | null; updatedAgo?: string } = {},
  ) {
    const id = newId();
    const ref = opts.providerRef === undefined ? randomUUID() : opts.providerRef;
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, provider_ref, amount, status,
        expires_at, created_at, updated_at)
      values (${id}, ${txId}, ${methodId}, ${providerId}, ${ref}, ${AMOUNT.toString()}, ${status},
        now() - ${opts.expiresAgo ?? "10 minutes"}::interval,
        now() - ${opts.updatedAgo ?? "0 minutes"}::interval, now() - ${opts.updatedAgo ?? "0 minutes"}::interval)`;
    paymentIds.push(id);
    return { id, ref };
  }

  const one = async <T>(q: Promise<Record<string, unknown>[]>) => (await q)[0] as T;
  const payStatus = async (id: string) =>
    (await one<{ status: string }>(sql`select status from payments where id = ${id}`)).status;
  const txStatus = async (id: string) =>
    (await one<{ status: string }>(sql`select status from transactions where id = ${id}`)).status;
  const campaign = async () =>
    one<{ c: string; n: number }>(
      sql`select collected_amount::text as c, donor_count as n from campaigns where id = ${campaignId}`,
    );
  const audits = async (entityId: string, action: string) =>
    (await sql`select metadata from audit_logs where entity_id = ${entityId} and action = ${action}
      order by id`) as { metadata: Record<string, unknown> }[];

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] =
      await sql`select m.id, m.provider_id from payment_methods m join payment_providers p on p.id = m.provider_id where p.code = 'midtrans' and left(m.code, 3) <> 'it_' limit 1`;
    if (!cat || !m) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji job', ${`it-job-${campaignId}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html, status,
        featured_image_url, featured_image_alt, published_at, start_at, end_at)
      values (${endedCampaignId}, ${cat.id}, 'Campaign uji job selesai', ${`it-job-end-${endedCampaignId}`}, 'uji',
        '<p>uji</p>', 'published', 'https://example.test/a.jpg', 'uji', now() - interval '3 days',
        now() - interval '3 days', now() + interval '1 day')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${`it+${donorId}@example.test`}, 'Uji')`;
  });

  afterAll(async () => {
    const entityIds = [...paymentIds, ...txIds, campaignId, endedCampaignId];
    await sql`delete from audit_logs where entity_id = any(${entityIds}::text[])`;
    if (paymentIds.length) {
      await sql`delete from payment_events where payment_id = any(${paymentIds}::uuid[])`;
      await sql`delete from payments where id = any(${paymentIds}::uuid[])`;
    }
    if (txIds.length) await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from campaigns where id = any(${[campaignId, endedCampaignId]}::uuid[])`;
    if (receiptsIssued) {
      await sql`update receipt_counters set last_seq = last_seq - ${receiptsIssued}
        where year = ${year} and not exists (
          select 1 from transactions where receipt_no like ${`KW/${year}/%`}
            and substring(receipt_no from 9)::int > last_seq - ${receiptsIssued})`;
    }
  });

  // ------------------------------------------------------------------ expire-payments
  describe("expire-payments", () => {
    it("pending lewat expiry, provider masih pending → expirePayment lalu expired (AC-18.1)", async () => {
      const tx = await newTx("pending");
      const p = await newPay(tx, "pending");
      api.set(p.id, { status: "pending", trx: p.ref! });
      const r = await runExpirePayments(deps, { deadline: far(), scope });
      expect(calls.expire).toContain(p.id);
      expect(r.expired).toBeGreaterThanOrEqual(1);
      expect(await payStatus(p.id)).toBe("expired");
      expect(await txStatus(tx)).toBe("expired");
    });

    it("belum lewat expires_at + 5 menit → tidak disentuh", async () => {
      const tx = await newTx("pending");
      const p = await newPay(tx, "pending", { expiresAgo: "2 minutes" });
      api.set(p.id, { status: "pending", trx: p.ref! });
      calls.status.length = 0;
      await runExpirePayments(deps, { deadline: far(), scope });
      expect(calls.status).not.toContain(p.id);
      expect(await payStatus(p.id)).toBe("pending");
      api.delete(p.id);
      await sql`update payments set expires_at = now() + interval '1 hour' where id = ${p.id}`;
    });

    it("provider settlement → paid sekali (BR-19), outbox + notifikasi; run ulang idempoten", async () => {
      const before = await campaign();
      const tx = await newTx("pending");
      const p = await newPay(tx, "pending");
      api.set(p.id, { status: "settlement", trx: p.ref! });
      deps.publishPaid.mockClear();
      const r = await runExpirePayments(deps, { deadline: far(), scope });
      receiptsIssued += 1;
      expect(r.paid).toBe(1);
      expect(await payStatus(p.id)).toBe("paid");
      expect(await txStatus(tx)).toBe("paid");
      const after = await campaign();
      expect(BigInt(after.c) - BigInt(before.c)).toBe(AMOUNT);
      expect(after.n - before.n).toBe(1);
      expect(deps.publishPaid).toHaveBeenCalledWith(
        { event: "payment.paid", transactionId: tx, paymentId: p.id },
        expect.anything(),
      );
      expect(await audits(tx, "notification.pending")).toHaveLength(1);
      expect(calls.expire).not.toContain(p.id);

      await runExpirePayments(deps, { deadline: far(), scope }); // tidak pending lagi
      expect((await campaign()).c).toBe(after.c);
    });

    it("order tidak dikenal Midtrans (404) → expired + reconciliation.issue", async () => {
      const tx = await newTx("pending");
      const p = await newPay(tx, "pending");
      api.delete(p.id);
      const r = await runExpirePayments(deps, { deadline: far(), scope });
      expect(r.missingAtProvider).toBe(1);
      expect(await payStatus(p.id)).toBe("expired");
      const iss = await audits(p.id, "reconciliation.issue");
      expect(iss[0]?.metadata).toMatchObject({ kind: "missing_at_provider" });
    });

    it("gangguan Midtrans (5xx) → tidak berubah, dihitung error", async () => {
      const tx = await newTx("pending");
      const p = await newPay(tx, "pending");
      api.set(p.id, { status: "pending", trx: p.ref! });
      fetchStub.mockImplementationOnce(
        async () => new Response(JSON.stringify({ status_code: "503" }), { status: 200 }),
      );
      // Gangguan hanya pada panggilan pertama (payment terlama mungkin lain) → cek total error.
      const r = await runExpirePayments(deps, { deadline: far(), scope });
      expect(r.errors).toBeGreaterThanOrEqual(1);
      // Run berikutnya membereskannya.
      await runExpirePayments(deps, { deadline: far(), scope });
      expect(await payStatus(p.id)).toBe("expired");
    });

    it("batch: batchSize 2 dengan 3 kandidat → 2 batch, semua diproses", async () => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const tx = await newTx("pending");
        const p = await newPay(tx, "pending", { expiresAgo: `${20 + i} minutes` });
        api.set(p.id, { status: "pending", trx: p.ref! });
        ids.push(p.id);
      }
      const r = await runExpirePayments(deps, { deadline: far(), batchSize: 2, scope });
      expect(r.batches).toBe(2);
      expect(r.checked).toBe(3);
      for (const id of ids) expect(await payStatus(id)).toBe("expired");
    });

    it("M2: payment yang terus gagal tidak diulang dalam satu run; last_checked_at diperbarui", async () => {
      const tx = await newTx("pending");
      const p = await newPay(tx, "pending");
      api.set(p.id, { status: "pending", trx: p.ref! });
      const failing = vi.fn(
        async () => new Response(JSON.stringify({ status_code: "503" }), { status: 200 }),
      );
      fetchStub.mockImplementation(failing);
      calls.status.length = 0;
      try {
        const r = await runExpirePayments(deps, { deadline: far(), batchSize: 1, scope });
        expect(r.errors).toBe(1);
        expect(r.checked).toBe(1);
      } finally {
        fetchStub.mockReset();
        fetchStub.mockImplementation(stubImpl);
      }
      const [row] = await sql`select status, last_checked_at from payments where id = ${p.id}`;
      expect(row!.status).toBe("pending");
      expect(row!.last_checked_at).not.toBeNull();
      await runExpirePayments(deps, { deadline: far(), scope });
      expect(await payStatus(p.id)).toBe("expired");
    });

    it("M3: badai 404 (>50% batch, min 5) → status tidak diubah, alert provider_404_storm", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        const tx = await newTx("pending");
        const p = await newPay(tx, "pending");
        api.delete(p.id);
        ids.push(p.id);
      }
      const errSpy = vi.spyOn(console, "error");
      const r = await runExpirePayments(deps, { deadline: far(), scope });
      expect(r.notFoundStorm).toBe(true);
      expect(r.notFoundHeld).toBe(6);
      expect(r.missingAtProvider).toBe(0);
      for (const id of ids) expect(await payStatus(id)).toBe("pending");
      expect(errSpy.mock.calls.some((c) => String(c[0]).includes("provider_404_storm"))).toBe(true);
      errSpy.mockRestore();
      await sql`update payments set status = 'cancelled' where id = any(${ids}::uuid[])`;
    });

    it("P11: transaksi pending tanpa payment aktif (ganti metode gagal) → status attempt terakhir", async () => {
      const tx = await newTx("pending", "2 hours");
      await newPay(tx, "cancelled", { updatedAgo: "90 minutes" });
      await newPay(tx, "failed", { updatedAgo: "60 minutes", providerRef: null });
      // Kontrol: aktivitas payment baru → belum disentuh.
      const fresh = await newTx("pending", "2 hours");
      await newPay(fresh, "failed", { updatedAgo: "5 minutes", providerRef: null });
      const r = await runExpirePayments(deps, { deadline: far(), scope });
      expect(r.healedTransactions).toBe(1);
      expect(await txStatus(tx)).toBe("failed");
      expect(await txStatus(fresh)).toBe("pending");
      expect(await audits(tx, "transaction.status_healed")).toHaveLength(1);
      await sql`update transactions set status = 'failed' where id = ${fresh}`;
    });
  });

  // ------------------------------------------------------------------ cancel-stale
  describe("cancel-stale (BR-15)", () => {
    it("created > 24 jam tanpa payment aktif → cancelled; lainnya tidak; idempoten", async () => {
      const stale = await newTx("created", "25 hours");
      const staleFailed = await newTx("created", "25 hours");
      await newPay(staleFailed, "failed", { providerRef: null });
      const young = await newTx("created", "2 hours");
      const withPending = await newTx("created", "25 hours");
      const pp = await newPay(withPending, "pending", { expiresAgo: "-1 hour" });
      const r = await runCancelStale({ deadline: far(), scope });
      expect(r.cancelled).toBe(2);
      expect(await txStatus(stale)).toBe("cancelled");
      expect(await txStatus(staleFailed)).toBe("cancelled");
      expect(await txStatus(young)).toBe("created");
      expect(await txStatus(withPending)).toBe("created");
      expect(await audits(stale, "transaction.cancelled_stale")).toHaveLength(1);
      expect((await runCancelStale({ deadline: far(), scope })).cancelled).toBe(0);
      await sql`update payments set status = 'cancelled' where id = ${pp.id}`;
    });
  });

  // ------------------------------------------------------------------ reconcile
  describe("reconcile", () => {
    it("paid di provider, pending di DB → paid + issue; orphan/failed live → expire; anomali webhook; total campaign; outbox", async () => {
      deps.publishAdminAlert.mockClear();
      deps.publishPaid.mockClear();
      // (a) AC-18.2: pending (belum lewat expiry) tapi provider sudah settlement.
      const txA = await newTx("pending");
      const a = await newPay(txA, "pending", { expiresAgo: "-1 hour" });
      api.set(a.id, { status: "settlement", trx: a.ref! });
      // (b) payment failed dengan provider_ref + audit orphan_charge; charge masih hidup.
      const txB = await newTx("created");
      const b = await newPay(txB, "failed");
      api.set(b.id, { status: "pending", trx: b.ref! });
      await sql`insert into audit_logs (actor_type, action, entity_type, entity_id, metadata)
        values ('system', 'payment.orphan_charge', 'payment', ${b.id},
          ${JSON.stringify({ paymentId: b.id, transactionId: txB, providerRef: b.ref })}::jsonb)`;
      await sql`update payments set created_at = now() - interval '5 days', updated_at = now() - interval '5 days'
        where id = ${b.id}`; // di luar jendela 48 jam: hanya ditemukan lewat audit orphan
      // (c) event webhook ditolak untuk payment expired yang ternyata dibayar.
      const txC = await newTx("expired");
      const c = await newPay(txC, "expired");
      api.set(c.id, { status: "settlement", trx: c.ref! });
      await sql`insert into payment_events (id, provider_id, payment_id, event_type, verification, result, payload, received_at)
        values (${newId()}, ${providerId}, ${c.id}, 'notification', 'rejected', 'received', ${JSON.stringify({ order_id: c.id })}::jsonb,
          now() - interval '1 hour')`;
      await sql`update payments set created_at = now() - interval '5 days', updated_at = now() - interval '5 days'
        where id = ${c.id}`;
      // (d) payment `created` macet tanpa charge di Midtrans → failed (transaksi tidak disentuh).
      const txD = await newTx("created");
      const d = await newPay(txD, "created", { updatedAgo: "1 hour", providerRef: null });
      // (e) outbox: transaksi paid dengan penanda notification.pending tanpa notification_logs.
      const txE = await newTx("pending");
      const e = await newPay(txE, "pending", { expiresAgo: "-1 hour" });
      api.set(e.id, { status: "settlement", trx: e.ref! });

      const before = await campaign();
      const r = await runReconcile(deps, { deadline: far(), scope, date: "2026-11-10" });
      receiptsIssued += 2; // a + e
      expect(r.fromOrphanAudits).toBe(1);
      expect(r.fromWebhookAnomalies).toBe(1);

      expect(await payStatus(a.id)).toBe("paid");
      expect(await txStatus(txA)).toBe("paid");
      expect((await audits(a.id, "reconciliation.issue"))[0]?.metadata).toMatchObject({
        kind: "provider_paid_db_pending",
        providerStatus: "paid",
      });
      expect(BigInt((await campaign()).c) - BigInt(before.c)).toBe(2n * AMOUNT);

      expect(calls.expire).toContain(b.id);
      expect(await payStatus(b.id)).toBe("failed");
      expect((await audits(b.id, "reconciliation.issue"))[0]?.metadata).toMatchObject({
        kind: "live_charge_on_closed_payment",
        action: "expired_at_provider",
      });

      expect(await payStatus(c.id)).toBe("expired"); // tidak pernah kembali paid
      expect(await txStatus(txC)).toBe("expired");
      expect((await audits(c.id, "reconciliation.issue"))[0]?.metadata).toMatchObject({
        kind: "paid_after_terminal",
        action: "ignored_transition",
        alert: "paid_after_terminal",
      });
      expect(await audits(c.id, "payment.needs_review")).toHaveLength(1);

      expect(await payStatus(d.id)).toBe("failed");
      expect(await txStatus(txD)).toBe("created");

      expect(r.alertPublished).toBe(true);
      expect(deps.publishAdminAlert).toHaveBeenCalledTimes(1);
      expect(deps.publishAdminAlert.mock.calls[0]![0]).toMatchObject({
        event: "admin.alert",
        kind: "reconciliation",
        date: "2026-11-10",
      });

      // Outbox: penanda e sudah ditulis (becamePaid); dimundurkan agar melewati umur minimum.
      await sql`update audit_logs set created_at = now() - interval '20 minutes'
        where entity_id = ${txE} and action = 'notification.pending'`;
      deps.publishPaid.mockClear();
      const r2 = await runReconcile(deps, { deadline: far(), scope, date: "2026-11-10" });
      expect(r2.outboxUndrained).toBeGreaterThanOrEqual(1);
      expect(deps.publishPaid).toHaveBeenCalledWith(
        { event: "payment.paid", transactionId: txE, paymentId: e.id },
        expect.anything(),
      );
      // Run ulang tidak menambah total lagi (idempoten).
      expect(BigInt((await campaign()).c) - BigInt(before.c)).toBe(2n * AMOUNT);
    });

    it("collected_amount ≠ SUM(paid) → dilaporkan, TIDAK diperbaiki", async () => {
      await sql`update campaigns set collected_amount = collected_amount + 1 where id = ${campaignId}`;
      const before = await campaign();
      const r = await runReconcile(deps, { deadline: far(), scope, date: "2026-11-10" });
      expect(r.campaignMismatches).toBe(1);
      expect((await campaign()).c).toBe(before.c);
      const iss = await audits(campaignId, "reconciliation.issue");
      expect(iss.at(-1)?.metadata).toMatchObject({
        kind: "campaign_total_mismatch",
        diff: "1",
        action: "report_only",
      });
    });
  });

  // ------------------------------------------------------------------ campaign-scheduler
  describe("campaign-scheduler", () => {
    it("published dengan end_at lewat → completed + revalidate; idempoten", async () => {
      // DB dev dipakai bersama: schedule QStash deployment Preview (*/15, tanpa scope) bisa
      // menyelesaikan fixture lebih dulu bila end_at sudah lewat sejak beforeAll. end_at baru
      // dibuat lewat tepat sebelum job dijalankan, dan hasil akhir diperiksa apa pun pelakunya:
      // tepat satu transisi + satu audit (idempotensi tetap teruji).
      await sql`update campaigns set end_at = now() - interval '1 minute' where id = ${endedCampaignId}`;
      const r = await runCampaignScheduler({
        revalidateTags: deps.revalidateTags,
        scope: { campaignIds: [endedCampaignId, campaignId] },
      });
      const [c] = await sql`select status, slug from campaigns where id = ${endedCampaignId}`;
      expect(c!.status).toBe("completed");
      expect(await audits(endedCampaignId, "campaign.auto_completed")).toHaveLength(1);
      expect(r.completed).toBeLessThanOrEqual(1);
      if (r.completed === 1) {
        expect(deps.revalidateTags).toHaveBeenCalledWith(["campaigns", `campaign:${c!.slug}`]);
      } else {
        console.warn("campaign-scheduler: fixture diselesaikan scheduler eksternal (Preview) lebih dulu");
      }
      const again = await runCampaignScheduler({
        revalidateTags: deps.revalidateTags,
        scope: { campaignIds: [endedCampaignId] },
      });
      expect(again.completed).toBe(0);
      expect(await audits(endedCampaignId, "campaign.auto_completed")).toHaveLength(1);
    });
  });
});
