/**
 * P22 — admin keuangan terhadap DB nyata (Neon `dev`): filter & pencarian transaksi/donatur
 * (termasuk anti-oracle PII), CSV mengikuti filter + audit, ekspor async (fake store + fake
 * publish), cek status ke provider (stub HTTP Midtrans) hanya lewat applyVerifiedStatus (BR-18/19),
 * tes koneksi (404 = OK, 401 = kredensial salah), simpan metode pembayaran + audit + invalidasi.
 * Semua baris uji ber-prefix it-p22 dan dihapus di afterAll; baris seed tidak diubah.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn(async () => undefined);
vi.mock("@/server/services/payment-service", async (orig) => ({
  ...(await orig<typeof import("@/server/services/payment-service")>()),
  invalidatePaymentMethodsCache: () => invalidate(),
}));

import { newId } from "@/lib/id";
import { createLogger } from "@/lib/logger";
import { createMidtransProvider } from "@/lib/payments/midtrans/provider";
import { setExportStoreForTests, type ExportStore } from "@/lib/storage/export-storage";
import { transactionFilterSchema } from "@/lib/validation/admin-finance";
import { ROLE_PERMISSIONS } from "../../scripts/seed/reference-data";
import { countAdminTransactions, findAdminDonor, listAdminDonors, listAdminTransactions } from "@/server/repositories/admin-finance-repository";
import { AdminForbiddenError, type AdminActor } from "@/server/services/admin-campaign-service";
import { csvChunks, runExportJob, startExport, type ExportJobBody } from "@/server/services/admin-export-service";
import { checkTransactionStatus, reorderPaymentMethods, savePaymentMethod, testProviderConnection } from "@/server/services/admin-finance-service";
import type { JobServiceDeps } from "@/server/services/jobs/job-deps";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const AMOUNT = 50_000n;

/** P25 (L3): penyimpanan filter ekspor di memori (pengganti Redis di test). */
class MemoryFilterStore {
  data = new Map<string, Record<string, unknown>>();
  async save(id: string, f: Record<string, unknown>) {
    this.data.set(id, f);
  }
  async load(id: string) {
    return this.data.get(id) ?? null;
  }
}

class MemoryStore implements ExportStore {
  files = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    this.files.set(key, data);
  }
  async get(key: string) {
    const f = this.files.get(key);
    return f ? new Response(new Uint8Array(f)).body : null;
  }
  async exists(key: string) {
    return this.files.has(key);
  }
  async deleteOlderThan() {
    return 0;
  }
}

describe.skipIf(!ENABLED)("admin keuangan P22 (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const log = createLogger({ test: "p22" });
  const tag = randomUUID().slice(0, 8);
  const campaignId = newId();
  const donorA = newId();
  const donorB = newId();
  const adminIds: Record<string, string> = {};
  const txIds: string[] = [];
  const paymentIds: string[] = [];
  const exportIds: string[] = [];
  let providerId: string;
  let methodId: string;
  let ownMethodId: string;
  let receiptsIssued = 0;
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }).format(new Date()));
  const emailA = `it-p22+${tag}-a@example.test`;
  const emailB = `it-p22+${tag}-b@example.test`;
  const phoneA = `+62812${String(Date.now()).slice(-8)}`;

  const actor = (role: keyof typeof ROLE_PERMISSIONS): AdminActor => ({
    adminId: adminIds[role]!,
    permissions: [...ROLE_PERMISSIONS[role]],
    ip: "127.0.0.1",
    ua: "vitest",
  });

  // ---- Stub Midtrans ----
  const api = new Map<string, { status: string; gross?: string }>();
  let authFails = false;
  const fetchStub = vi.fn(async (url: string | URL | Request) => {
    if (authFails) return new Response(JSON.stringify({ status_code: "401", status_message: "Unauthorized" }), { status: 401 });
    const m = /\/v2\/([^/]+)\/status$/.exec(String(url));
    const id = m ? decodeURIComponent(m[1]!) : "";
    const s = api.get(id);
    if (!s) return new Response(JSON.stringify({ status_code: "404", status_message: "Transaction doesn't exist." }), { status: 404 });
    return new Response(
      JSON.stringify({
        status_code: s.status === "settlement" ? "200" : "201",
        order_id: id,
        transaction_id: `trx-${id}`,
        transaction_status: s.status,
        gross_amount: s.gross ?? `${AMOUNT}.00`,
        transaction_time: "2026-11-10 10:00:00",
        settlement_time: s.status === "settlement" ? "2026-11-10 10:05:00" : undefined,
        fraud_status: "accept",
      }),
      { status: 200 },
    );
  });
  const provider = createMidtransProvider({ serverKey: "SB-Mid-server-P22ITKEY", isProduction: false, recordEvent: async () => {}, fetch: fetchStub as unknown as typeof fetch, logger: log });
  const deps = {
    log,
    getProvider: () => provider,
    publishPaid: vi.fn<JobServiceDeps["publishPaid"]>(async () => {}),
    revalidateCampaign: vi.fn<JobServiceDeps["revalidateCampaign"]>(async () => {}),
    publishAdminAlert: vi.fn<JobServiceDeps["publishAdminAlert"]>(async () => {}),
    revalidateTags: vi.fn<JobServiceDeps["revalidateTags"]>(),
  } satisfies JobServiceDeps;

  const code = () => `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").padEnd(6, "A").slice(0, 6)}`;

  async function newTx(opts: { donor: string; email: string; name: string; status: string; phone?: string | null; createdAt?: string }) {
    const id = newId();
    const c = code();
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount, status,
        campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, donor_phone_snapshot, paid_at, created_at)
      values (${id}, ${c}, ${randomBytes(32)}, now() + interval '1 day', ${campaignId}, ${opts.donor}, ${AMOUNT.toString()}, ${opts.status},
        ${`Campaign it-p22 ${tag}`}, ${opts.name}, ${opts.email}, ${opts.phone ?? null},
        ${opts.status === "paid" ? new Date() : null}, ${opts.createdAt ?? new Date().toISOString()})`;
    txIds.push(id);
    return { id, code: c };
  }
  async function newPay(txId: string, status: string, method = methodId) {
    const id = newId();
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, provider_ref, amount, status, expires_at)
      values (${id}, ${txId}, ${method}, ${providerId}, ${`ref-${id}`}, ${AMOUNT.toString()}, ${status}, now() + interval '1 hour')`;
    paymentIds.push(id);
    return id;
  }
  const scoped = (f: Record<string, string>) => transactionFilterSchema.parse({ campaign: campaignId, ...f });
  const csvOf = async (gen: AsyncGenerator<string>) => {
    let s = "";
    for await (const c of gen) s += c;
    return s;
  };

  let paidTx: { id: string; code: string };
  let pendingTx: { id: string; code: string };
  let oldTx: { id: string; code: string };

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    const [m] = await sql`select m.id, m.provider_id from payment_methods m join payment_providers p on p.id = m.provider_id where p.code = 'midtrans' and left(m.code, 3) <> 'it_' order by m.display_order limit 1`;
    if (!cat || !m) throw new Error("reference seed belum ada (pnpm db:seed)");
    methodId = m.id as string;
    providerId = m.provider_id as string;
    for (const role of ["owner", "admin", "finance", "editor"] as const) {
      const id = newId();
      adminIds[role] = id;
      await sql`insert into admin_users (id, email, name, password_hash, must_change_password)
        values (${id}, ${`it-p22+${tag}-${role}@example.test`}, ${`Uji P22 ${role}`}, 'x', false)`;
      await sql`insert into admin_user_roles (admin_user_id, role_id) select ${id}, id from roles where code = ${role}`;
    }
    // Metode milik test (bukan seed) untuk uji simpan + filter metode.
    ownMethodId = newId();
    await sql`insert into payment_methods (id, provider_id, code, provider_channel, type, display_name, is_active, display_order)
      values (${ownMethodId}, ${providerId}, ${`it_p22_${tag}`}, 'bca', 'virtual_account', 'Uji P22 VA', false, 9999)`;
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, ${`Campaign it-p22 ${tag}`}, ${`it-p22-${tag}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name, phone_e164) values (${donorA}, ${emailA}, ${`Budiman P22 ${tag}`}, ${phoneA})`;
    await sql`insert into donors (id, email, name) values (${donorB}, ${emailB}, ${`Siti P22 ${tag}`})`;
    paidTx = await newTx({ donor: donorA, email: emailA, name: `Budiman P22 ${tag}`, status: "paid", phone: phoneA });
    await newPay(paidTx.id, "paid");
    pendingTx = await newTx({ donor: donorB, email: emailB, name: `Siti P22 ${tag}`, status: "pending" });
    await newPay(pendingTx.id, "pending", ownMethodId);
    oldTx = await newTx({ donor: donorB, email: emailB, name: `=Siti P22 ${tag}`, status: "expired", createdAt: "2026-01-15T03:00:00Z" });
  });

  afterAll(async () => {
    setExportStoreForTests(undefined);
    const ids = [...txIds, ...paymentIds, ...exportIds, campaignId, ownMethodId, "midtrans", ...Object.values(adminIds)];
    await sql`delete from audit_logs where entity_id = any(${ids}::text[]) and created_at > now() - interval '1 hour'
      and (actor_id = any(${Object.values(adminIds)}::uuid[]) or actor_type <> 'admin')`;
    await sql`delete from audit_logs where actor_id = any(${Object.values(adminIds)}::uuid[])`;
    if (paymentIds.length) {
      await sql`delete from payment_events where payment_id = any(${paymentIds}::uuid[])`;
      await sql`delete from payments where id = any(${paymentIds}::uuid[])`;
    }
    await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    await sql`delete from donors where id = any(${[donorA, donorB]}::uuid[])`;
    await sql`delete from campaigns where id = ${campaignId}`;
    await sql`delete from payment_methods where id = ${ownMethodId}`;
    await sql`delete from admin_user_roles where admin_user_id = any(${Object.values(adminIds)}::uuid[])`;
    await sql`delete from admin_users where id = any(${Object.values(adminIds)}::uuid[])`;
    if (receiptsIssued) {
      await sql`update receipt_counters set last_seq = last_seq - ${receiptsIssued}
        where year = ${year} and not exists (select 1 from transactions where receipt_no like ${`KW/${year}/%`}
          and substring(receipt_no from 9)::int > last_seq - ${receiptsIssued})`;
    }
  });

  // ------------------------------------------------------------ Transaksi: filter & cari
  describe("daftar transaksi", () => {
    it("filter status, metode, tanggal, kode", async () => {
      expect((await listAdminTransactions(scoped({}), 1, false)).total).toBe(3);
      const paid = await listAdminTransactions(scoped({ status: "paid" }), 1, false);
      expect(paid.rows.map((r) => r.id)).toEqual([paidTx.id]);
      const method = await listAdminTransactions(scoped({ metode: `it_p22_${tag}` }), 1, false);
      expect(method.rows.map((r) => r.id)).toEqual([pendingTx.id]);
      const jan = await listAdminTransactions(scoped({ dari: "2026-01-15", sampai: "2026-01-15" }), 1, false);
      expect(jan.rows.map((r) => r.id)).toEqual([oldTx.id]);
      const byCode = await listAdminTransactions(scoped({ q: paidTx.code.toLowerCase() }), 1, false);
      expect(byCode.rows.map((r) => r.id)).toEqual([paidTx.id]);
    });

    it("cari email/WA: parsial hanya untuk pemegang donors.export; tanpa itu wajib nilai persis (anti-oracle)", async () => {
      const partial = emailA.slice(0, 18);
      expect((await listAdminTransactions(scoped({ q: `${partial}@` }), 1, false)).total).toBe(0);
      expect((await listAdminTransactions(scoped({ q: emailA.split("@")[0]! + "@" }), 1, false)).total).toBe(1);
      expect((await listAdminTransactions(scoped({ q: emailA.split("@")[0]! + "@" }), 1, true)).total).toBe(0);
      expect((await listAdminTransactions(scoped({ q: emailA }), 1, true)).total).toBe(1);
      const local = `0${phoneA.slice(3)}`;
      expect((await listAdminTransactions(scoped({ q: local }), 1, true)).total).toBe(1);
      expect((await listAdminTransactions(scoped({ q: local.slice(0, 9) }), 1, true)).total).toBe(0);
    });

    it("LIKE di-escape: % dan _ tidak menjadi wildcard", async () => {
      expect((await listAdminTransactions(scoped({ q: "%" }), 1, false)).total).toBe(0);
      expect((await listAdminTransactions(scoped({ q: "_" }), 1, false)).total).toBe(0);
    });
  });

  // ------------------------------------------------------------ Donatur
  describe("donatur", () => {
    it("total/jumlah dari transaksi paid; filter tipe; detail + riwayat", async () => {
      const r = await listAdminDonors({ q: `P22 ${tag}`, urut: "total" }, 1, false);
      expect(r.rows.map((d) => d.id)).toEqual([donorA, donorB]);
      expect(r.rows[0]).toMatchObject({ totalPaid: AMOUNT, paidCount: 1, hasAccount: false });
      expect(r.rows[1]).toMatchObject({ totalPaid: 0n, paidCount: 0 });
      expect((await listAdminDonors({ q: `P22 ${tag}`, tipe: "akun", urut: "total" }, 1, false)).total).toBe(0);
      const d = await findAdminDonor(donorB);
      expect(d?.history.map((h) => h.id).sort()).toEqual([pendingTx.id, oldTx.id].sort());
    });
  });

  // ------------------------------------------------------------ Ekspor
  describe("ekspor CSV", () => {
    it("CSV mengikuti filter, formula dinetralkan, PII dimasking tanpa donors.export", async () => {
      const req = { kind: "transactions" as const, filters: scoped({ status: "expired" }) };
      const full = await csvOf(csvChunks(req, false));
      const lines = full.trim().split("\r\n");
      expect(lines).toHaveLength(2);
      expect(full).toContain(oldTx.code);
      expect(full).not.toContain(paidTx.code);
      expect(full).toContain(`'=Siti P22 ${tag}`);
      const masked = await csvOf(csvChunks({ kind: "transactions", filters: scoped({ status: "paid" }) }, true));
      expect(masked).toContain(paidTx.code);
      expect(masked).not.toContain(emailA);
      expect(masked).not.toContain(phoneA);
    });

    it("startExport: stream ≤ batas + audit; permission dicek; donor export butuh donors.export", async () => {
      const store = new MemoryStore();
      const publish = vi.fn(async () => undefined);
      const r = await startExport(actor("admin"), { kind: "transactions", filters: { campaign: campaignId } }, { store, publish });
      expect(r.mode).toBe("stream");
      const [a] = await sql`select metadata from audit_logs where actor_id = ${adminIds.admin} and action = 'transaction.export' order by id desc limit 1`;
      expect(a?.metadata).toMatchObject({ rows: 3, masked: true, mode: "stream", filters: { campaign: campaignId } });
      expect((await startExport(actor("admin"), { kind: "donors", filters: {} }, { store, publish })).mode).toBe("error");
      expect((await startExport(actor("editor"), { kind: "transactions", filters: {} }, { store, publish })).mode).toBe("error");
      expect((await startExport(actor("finance"), { kind: "transactions", filters: { status: "x" } }, { store, publish })).mode).toBe("stream");
      expect(publish).not.toHaveBeenCalled();
    });

    it("async (> batas): antre + token, job menulis berkas sesuai filter + audit selesai", async () => {
      const store = new MemoryStore();
      let queued: ExportJobBody | null = null;
      const filters = new MemoryFilterStore();
      const r = await startExport(actor("finance"), { kind: "transactions", filters: { campaign: campaignId, status: "paid", q: emailA } }, {
        store,
        filters,
        publish: async (b) => {
          queued = b;
        },
        syncLimit: 0,
      });
      expect(r.mode).toBe("async");
      if (r.mode !== "async") return;
      exportIds.push(r.exportId);
      expect(queued).toMatchObject({ exportId: r.exportId, adminId: adminIds.finance, kind: "transactions" });
      // P25 (L3): body QStash tanpa filter/kata kunci; filter disimpan di server.
      expect(JSON.stringify(queued)).not.toContain(emailA);
      expect(queued).not.toHaveProperty("filters");
      expect(filters.data.get(r.exportId)).toMatchObject({ q: emailA });
      expect(await runExportJob({ ...queued! }, { store, log, filters: new MemoryFilterStore() })).toEqual({ failed: "filters_expired" });
      const out = await runExportJob(queued, { store, log, filters });
      expect(out).toMatchObject({ rows: 1 });
      const file = store.files.get(`exports/transactions/${r.exportId}.csv`)!.toString("utf8");
      expect(file).toContain(paidTx.code);
      expect(file).toContain(emailA); // finance punya donors.export
      expect(file).not.toContain(pendingTx.code);
      const done = await sql`select 1 from audit_logs where action = 'export.completed' and entity_id = ${r.exportId}`;
      expect(done).toHaveLength(1);
    });

    it("async tanpa storage → error jelas; job dengan admin tanpa izin → gagal & diaudit", async () => {
      const r = await startExport(actor("finance"), { kind: "transactions", filters: { campaign: campaignId } }, { store: null, publish: async () => undefined, syncLimit: 0 });
      expect(r).toMatchObject({ mode: "error", status: 503 });
      const exportId = randomUUID();
      exportIds.push(exportId);
      const out = await runExportJob({ exportId, adminId: adminIds.editor, kind: "transactions", filters: {} }, { store: new MemoryStore(), log });
      expect(out).toEqual({ failed: "permission_revoked" });
    });
  });

  describe("ekspor — perbaikan review keamanan", () => {
    it("M2: kata kunci email/WA tidak tersimpan di audit ekspor", async () => {
      const store = new MemoryStore();
      for (const q of [emailA, `0${phoneA.slice(3)}`]) {
        const r = await startExport(actor("finance"), { kind: "transactions", filters: { campaign: campaignId, q } }, { store, publish: async () => undefined });
        expect(r.mode).toBe("stream");
      }
      const rows = await sql`select metadata from audit_logs where actor_id = ${adminIds.finance} and action = 'transaction.export' order by id desc limit 2`;
      expect(JSON.stringify(rows)).not.toContain(emailA);
      expect(JSON.stringify(rows)).not.toContain(phoneA.slice(3));
      expect(rows.map((x) => (x.metadata as { filters: { q: string } }).filters.q)).toEqual(["[pii]", "[pii]"]);
    });

    it("L2: job memasking bila body.masked = true walau admin memegang donors.export", async () => {
      const store = new MemoryStore();
      const exportId = randomUUID();
      exportIds.push(exportId);
      await runExportJob({ exportId, adminId: adminIds.finance, kind: "transactions", filters: { campaign: campaignId, status: "paid" }, masked: true }, { store, log });
      const file = store.files.get(`exports/transactions/${exportId}.csv`)!.toString("utf8");
      expect(file).toContain(paidTx.code);
      expect(file).not.toContain(emailA);
    });

    it("I4: status 'failed' bila job tidak menghasilkan berkas setelah batas waktu", async () => {
      const { exportStatus, EXPORT_STALE_MS } = await import("@/server/services/admin-export-service");
      const r = await startExport(actor("finance"), { kind: "transactions", filters: { campaign: campaignId } }, { store: new MemoryStore(), filters: new MemoryFilterStore(), publish: async () => undefined, syncLimit: 0 });
      if (r.mode !== "async") throw new Error("harus async");
      exportIds.push(r.exportId);
      const store = new MemoryStore();
      expect(await exportStatus("transactions", r.exportId, store)).toBe("processing");
      expect(await exportStatus("transactions", r.exportId, store, Date.now() + EXPORT_STALE_MS + 60_000)).toBe("failed");
    });
  });

  // ------------------------------------------------------------ Cek status ke provider
  describe("cek status ke Midtrans (BR-18/19)", () => {
    it("editor ditolak; nominal beda tidak menjadikan paid", async () => {
      await expect(checkTransactionStatus(actor("editor"), pendingTx.id, deps)).rejects.toBeInstanceOf(AdminForbiddenError);
      const [p] = await sql`select id from payments where transaction_id = ${pendingTx.id}`;
      api.set(p!.id as string, { status: "settlement", gross: "1.00" });
      const r = await checkTransactionStatus(actor("finance"), pendingTx.id, deps);
      expect(r.ok).toBe(true);
      const [t] = await sql`select status from transactions where id = ${pendingTx.id}`;
      expect(t!.status).toBe("pending");
    });

    it("provider settlement → paid sekali, total campaign bertambah sekali; cek ulang idempoten", async () => {
      const [p] = await sql`select id from payments where transaction_id = ${pendingTx.id}`;
      api.set(p!.id as string, { status: "settlement" });
      const total = async () => BigInt(((await sql`select collected_amount::text c from campaigns where id = ${campaignId}`)[0]!.c as string));
      const before = await total();
      const r = await checkTransactionStatus(actor("finance"), pendingTx.id, deps);
      receiptsIssued += 1;
      expect(r.ok && r.message).toContain("paid");
      const [t] = await sql`select status from transactions where id = ${pendingTx.id}`;
      expect(t!.status).toBe("paid");
      expect((await total()) - before).toBe(AMOUNT);
      await checkTransactionStatus(actor("finance"), pendingTx.id, deps);
      expect((await total()) - before).toBe(AMOUNT);
      const audit = await sql`select metadata from audit_logs where entity_id = ${pendingTx.id} and action = 'transaction.status_check'`;
      expect(audit.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ------------------------------------------------------------ Tes koneksi
  describe("tes koneksi", () => {
    it("404 order fiktif = OK; 401 = kredensial salah; tanpa provider = belum dikonfigurasi; diaudit", async () => {
      authFails = false;
      expect((await testProviderConnection(actor("finance"), { getProvider: () => provider })).result).toBe("ok");
      authFails = true;
      expect((await testProviderConnection(actor("finance"), { getProvider: () => provider })).result).toBe("invalid_credentials");
      authFails = false;
      expect((await testProviderConnection(actor("finance"), { getProvider: () => null })).result).toBe("unconfigured");
      await expect(testProviderConnection(actor("admin"), { getProvider: () => provider })).rejects.toBeInstanceOf(AdminForbiddenError);
      const rows = await sql`select metadata from audit_logs where actor_id = ${adminIds.finance} and action = 'payment_provider.connection_test'`;
      expect(rows.length).toBe(3);
      expect(JSON.stringify(rows)).not.toContain("SB-Mid-server");
    });
  });

  // ------------------------------------------------------------ Metode pembayaran
  describe("metode pembayaran", () => {
    const values = {
      displayName: "Uji P22 VA Baru",
      logoUrl: null,
      isActive: false,
      minAmount: "15000",
      maxAmount: "5000000",
      expiryMinutes: 60,
      feeFlat: "4000",
      feePercent: "0",
      instructions: [{ title: "ATM", steps: ["Masukkan {{va_number}}", "Bayar {{amount}}"] }],
    };
    it("simpan → DB berubah, fee_borne_by tetap platform (OD-04), audit diff, cache diinvalidasi", async () => {
      invalidate.mockClear();
      const r = await savePaymentMethod(actor("finance"), ownMethodId, values);
      expect(r.ok).toBe(true);
      const [m] = await sql`select display_name, min_amount::text min, max_amount::text max, expiry_minutes, fee_flat::text fee, fee_borne_by, instructions from payment_methods where id = ${ownMethodId}`;
      expect(m).toMatchObject({ display_name: "Uji P22 VA Baru", min: "15000", max: "5000000", expiry_minutes: 60, fee: "4000", fee_borne_by: "platform" });
      expect(invalidate).toHaveBeenCalledTimes(1);
      const [a] = await sql`select before, after from audit_logs where entity_id = ${ownMethodId} and action = 'payment_method.update'`;
      expect(a?.after).toMatchObject({ displayName: "Uji P22 VA Baru", minAmount: "15000" });
    });
    it("validasi & izin: logo eksternal ditolak, admin (tanpa payment_methods.write) ditolak", async () => {
      const bad = await savePaymentMethod(actor("finance"), ownMethodId, { ...values, logoUrl: "https://evil.example/x.png" });
      expect(bad.ok).toBe(false);
      const inv = await savePaymentMethod(actor("finance"), ownMethodId, { ...values, minAmount: "100" });
      expect(inv.ok === false && inv.fieldErrors?.minAmount).toBeTruthy();
      await expect(savePaymentMethod(actor("admin"), ownMethodId, values)).rejects.toBeInstanceOf(AdminForbiddenError);
    });
    it("urutan: daftar tidak lengkap ditolak tanpa menulis", async () => {
      const before = await sql`select id, display_order from payment_methods order by id`;
      const r = await reorderPaymentMethods(actor("finance"), [ownMethodId]);
      expect(r.ok).toBe(false);
      expect(await sql`select id, display_order from payment_methods order by id`).toEqual(before);
    });
  });

  it("hitung transaksi untuk ekspor memakai filter yang sama dengan daftar", async () => {
    const f = scoped({ status: "paid" });
    expect(await countAdminTransactions(f, false)).toBe((await listAdminTransactions(f, 1, false)).total);
  });
});
