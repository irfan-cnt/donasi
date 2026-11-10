/**
 * P20 — KPI dashboard admin = query manual (AC-23.1), batas hari Asia/Jakarta, gating permission
 * (editor vs finance vs owner) dan otorisasi pencarian global, terhadap DB nyata (Neon `dev`).
 * Baris uji: donor @example.test + transaksi di Maret 2021 (jendela kosong, deterministik);
 * dihapus di afterAll. Tidak mengubah baris seed (collected_amount campaign tidak disentuh).
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import { generateTransactionCode } from "@/lib/transaction-code";
import { previousRange, resolveDashboardRange, type DashboardRange } from "@/lib/validation/admin-dashboard";
import { adminSearch, getAdminDashboard } from "@/server/services/admin-dashboard-service";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const CAMPAIGN = "contoh-beasiswa-santri-penghafal-quran";
interface Manual {
  paid_amount: string;
  paid_count: number;
  donors: number;
  pending_count: number;
  pending_amount: string;
  prev_amount: string;
  active: number;
  paused: number;
}

const RANGE: DashboardRange = { from: "2021-03-01", to: "2021-03-07", days: 7, preset: "custom" };

describe.skipIf(!ENABLED)("dashboard admin (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const donorIds: string[] = [];
  const perms: Record<string, string[]> = {};
  let campaignId: string;
  let paidCode: string;
  let d1Email: string;

  async function donor() {
    const email = `it-p20+${randomUUID()}@example.test`;
    const id = newId();
    await sql`insert into donors (id, email, name) values (${id}, ${email}, 'Donatur Uji P20')`;
    donorIds.push(id);
    return { id, email };
  }

  async function trx(donorId: string, email: string, status: string, amount: number, at: string, paid = status === "paid") {
    const code = generateTransactionCode(new Date(at));
    const created = new Date(new Date(at).getTime() - 5 * 60_000).toISOString();
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount,
        status, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, paid_at, created_at)
      values (${newId()}, ${code}, ${sha256(generateSessionToken())}, now(), ${campaignId}, ${donorId}, ${amount},
        ${status}, 'Program Uji P20', 'Donatur Uji P20', ${email}, ${paid ? at : null}, ${paid ? created : at})`;
    return code;
  }

  beforeAll(async () => {
    const [c] = await sql`select id from campaigns where slug = ${CAMPAIGN}`;
    if (!c) throw new Error("sample seed belum ada (pnpm db:seed:sample)");
    campaignId = c.id as string;
    const [existing] = await sql`select count(*)::int as n from transactions
      where created_at >= '2021-02-01' and created_at < '2021-04-01'`;
    if (existing!.n !== 0) throw new Error("jendela uji Feb–Mar 2021 tidak kosong");

    const rp = await sql`select r.code as role, rp.permission_code as perm from role_permissions rp
      join roles r on r.id = rp.role_id`;
    for (const r of rp) (perms[r.role as string] ??= []).push(r.perm as string);

    const d1 = await donor();
    const d2 = await donor();
    const d3 = await donor();
    d1Email = d1.email;
    // 2021-03-01T16:59:59Z = 1 Mar 23:59:59 WIB; 17:00:00Z = 2 Mar 00:00 WIB.
    paidCode = await trx(d1.id, d1.email, "paid", 100_000, "2021-03-01T16:59:59Z");
    await trx(d1.id, d1.email, "paid", 50_000, "2021-03-01T17:00:00Z");
    await trx(d2.id, d2.email, "paid", 25_000, "2021-03-07T16:00:00Z"); // 7 Mar 23:00 WIB
    await trx(d2.id, d2.email, "paid", 70_000, "2021-03-07T17:00:00Z"); // 8 Mar WIB → di luar
    await trx(d2.id, d2.email, "paid", 15_000, "2021-02-28T16:59:00Z"); // 28 Feb WIB → di luar
    await trx(d3.id, d3.email, "pending", 40_000, "2021-03-03T00:00:00Z");
    await trx(d3.id, d3.email, "created", 30_000, "2021-03-04T00:00:00Z");
    await trx(d3.id, d3.email, "expired", 10_000, "2021-03-04T01:00:00Z");
    await trx(d1.id, d1.email, "refunded", 20_000, "2021-03-05T00:00:00Z", true);
    await trx(d1.id, d1.email, "paid", 60_000, "2021-02-22T10:00:00Z"); // periode lalu
  });

  afterAll(async () => {
    if (donorIds.length) {
      await sql`delete from transactions where donor_id = any(${donorIds}::uuid[])`;
      await sql`delete from donors where id = any(${donorIds}::uuid[]) and email like '%@example.test'`;
    }
  });

  it("KPI = nilai deterministik (batas hari WIB, refunded/expired dikecualikan)", async () => {
    const data = await getAdminDashboard(perms.owner!, RANGE);
    expect(data.transactions!.kpis).toEqual({
      paidAmount: 175_000n,
      paidCount: 3,
      donorCount: 2,
      pendingCount: 2,
      pendingAmount: 70_000n,
      prevPaidAmount: 75_000n,
    });
    const daily = data.transactions!.daily;
    expect(daily.map((d) => d.day)).toEqual(["2021-03-01", "2021-03-02", "2021-03-03", "2021-03-04", "2021-03-05", "2021-03-06", "2021-03-07"]);
    expect(daily.map((d) => d.amount)).toEqual([100_000n, 50_000n, 0n, 0n, 0n, 0n, 25_000n]);
    // "Transaksi terbaru" memakai created_at (paid 70.000 dibuat 7 Mar 23:55 WIB → masuk rentang).
    expect(data.transactions!.latest.map((t) => t.amount)).toEqual([70_000n, 25_000n, 20_000n, 10_000n, 30_000n, 40_000n, 50_000n, 100_000n]);
  });

  it("KPI 30 hari = SQL manual independen (tanggal WIB) pada data dev", async () => {
    const range = resolveDashboardRange({}, new Date());
    const prev = previousRange(range);
    const day = (col: string) => `(${col} at time zone 'Asia/Jakarta')::date`;
    const manual = async () => (await sql.query(
      `select
        (select coalesce(sum(amount),0)::text from transactions where status='paid' and ${day("paid_at")} between $1::date and $2::date) as paid_amount,
        (select count(*)::int from transactions where status='paid' and ${day("paid_at")} between $1::date and $2::date) as paid_count,
        (select count(distinct donor_id)::int from transactions where status='paid' and ${day("paid_at")} between $1::date and $2::date) as donors,
        (select count(*)::int from transactions where status in ('created','pending') and ${day("created_at")} between $1::date and $2::date) as pending_count,
        (select coalesce(sum(amount),0)::text from transactions where status in ('created','pending') and ${day("created_at")} between $1::date and $2::date) as pending_amount,
        (select coalesce(sum(amount),0)::text from transactions where status='paid' and ${day("paid_at")} between $3::date and $4::date) as prev_amount,
        (select count(*)::int from campaigns where status='published') as active,
        (select count(*)::int from campaigns where status='paused') as paused`,
      [range.from, range.to, prev.from, prev.to],
    ))[0] as Manual;
    // Test integration lain berjalan paralel & mengubah transaksi: bandingkan hanya bila SQL manual
    // stabil sebelum & sesudah panggilan service (snapshot konsisten).
    let m: Manual | undefined;
    let data: Awaited<ReturnType<typeof getAdminDashboard>> | undefined;
    for (let i = 0; i < 5; i++) {
      const before = await manual();
      data = await getAdminDashboard(perms.owner!, range);
      const after = await manual();
      if (JSON.stringify(before) === JSON.stringify(after)) {
        m = after;
        break;
      }
    }
    if (!m || !data) throw new Error("data dev tidak stabil selama 5 percobaan");
    expect(data.transactions!.kpis).toEqual({
      paidAmount: BigInt(m!.paid_amount),
      paidCount: m!.paid_count,
      donorCount: m!.donors,
      pendingCount: m!.pending_count,
      pendingAmount: BigInt(m!.pending_amount),
      prevPaidAmount: BigInt(m!.prev_amount),
    });
    expect(data.campaigns!.counts).toEqual({ active: m!.active, paused: m!.paused });
    const dailySum = data.transactions!.daily.reduce((a, d) => a + d.amount, 0n);
    expect(dailySum).toBe(BigInt(m!.paid_amount));
    expect(data.transactions!.daily).toHaveLength(30);
  });

  it("editor (tanpa transactions.read) hanya mendapat widget campaign", async () => {
    expect(perms.editor).not.toContain("transactions.read");
    const data = await getAdminDashboard(perms.editor!, RANGE);
    expect(data.transactions).toBeNull();
    expect(data.campaigns!.top.length).toBeGreaterThan(0);
  });

  it("finance & owner mendapat semua widget", async () => {
    for (const role of ["finance", "owner"]) {
      const data = await getAdminDashboard(perms[role]!, RANGE);
      expect(data.transactions).not.toBeNull();
      expect(data.campaigns).not.toBeNull();
    }
  });

  it("pencarian kode transaksi butuh transactions.read", async () => {
    expect(await adminSearch(perms.editor!, paidCode)).toEqual([]);
    const res = await adminSearch(perms.finance!, paidCode);
    expect(res).toEqual([expect.objectContaining({ type: "transaction", title: paidCode })]);
  });

  it("pencarian email (PII) butuh donors.read", async () => {
    expect(perms.editor).not.toContain("donors.read");
    expect(await adminSearch(perms.editor!, d1Email)).toEqual([]);
    const res = await adminSearch(perms.finance!, d1Email.toUpperCase());
    expect(res).toEqual([expect.objectContaining({ type: "donor", subtitle: d1Email })]);
  });

  it("pencarian campaign butuh campaigns.read; wildcard LIKE di-escape", async () => {
    expect(await adminSearch([], "beasiswa")).toEqual([]);
    const res = await adminSearch(perms.editor!, "beasiswa");
    expect(res.some((r) => r.type === "campaign")).toBe(true);
    expect(await adminSearch(perms.editor!, "%%")).toEqual([]);
  });
});
