/**
 * GET /api/transactions/[code]/status (P12) + getTransactionView terhadap DB nyata (branch Neon
 * `dev`). Membuat campaign/donor/transaksi/payment uji sendiri dan menghapusnya di afterAll.
 */
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/transactions/[code]/status/route";
import { newId } from "@/lib/id";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import { getTransactionView } from "@/server/services/payment-service";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)("status transaksi (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const suffix = randomBytes(4).toString("hex");
  const campaignId = newId();
  const donorId = newId();
  const email = `it+status-${suffix}@example.test`;
  const txIds: string[] = [];

  async function newTransaction(status: "created" | "pending" | "paid") {
    const id = newId();
    const token = generateSessionToken();
    const code = `TK-000000-${randomBytes(3).toString("hex").toUpperCase().replace(/[ILOU]/g, "A").slice(0, 6)}`;
    await sql`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id,
        amount, status, paid_at, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, donor_phone_snapshot)
      values (${id}, ${code}, ${sha256(token)}, now() + interval '1 day', ${campaignId}, ${donorId},
        '75000', ${status}, ${status === "paid" ? new Date("2026-11-10T01:02:03Z") : null}, 'Campaign uji status',
        'Nama Rahasia', ${email}, '081234567890')`;
    txIds.push(id);
    return { id, code, token };
  }

  const call = (code: string, t: string | null) => {
    const qs = t === null ? "" : `?${new URLSearchParams({ t })}`;
    const req = new NextRequest(`http://localhost/api/transactions/${code}/status${qs}`, {
      headers: { "x-forwarded-for": `10.0.${randomBytes(1)[0]}.${randomBytes(1)[0]}` },
    });
    return GET(req, { params: Promise.resolve({ code }) });
  };

  beforeAll(async () => {
    const [cat] = await sql`select id from campaign_categories order by sort_order limit 1`;
    if (!cat) throw new Error("reference seed belum ada (pnpm db:seed)");
    await sql`insert into campaigns (id, category_id, title, slug, short_description, description_html)
      values (${campaignId}, ${cat.id}, 'Campaign uji status', ${`it-st-${suffix}`}, 'uji', '<p>uji</p>')`;
    await sql`insert into donors (id, email, name) values (${donorId}, ${email}, 'Nama Rahasia')`;
  });

  afterAll(async () => {
    if (txIds.length) {
      await sql`delete from payments where transaction_id = any(${txIds}::uuid[])`;
      await sql`delete from transactions where id = any(${txIds}::uuid[])`;
    }
    await sql`delete from donors where id = ${donorId}`;
    await sql`delete from campaigns where id = ${campaignId}`;
  });

  it("token salah / tanpa token / kode tidak valid → 404 + no-store", async () => {
    const t = await newTransaction("pending");
    for (const res of [
      await call(t.code, "A".repeat(43)),
      await call(t.code, null),
      await call("TK-BUKAN", t.token),
    ]) {
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(await res.json()).toEqual({ error: "not_found" });
    }
  });

  it("token sah → {status, paidAt} saja, no-store, status DB tidak berubah", async () => {
    const t = await newTransaction("pending");
    const res = await call(t.code, t.token);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({ status: "pending", paidAt: null });
    const [row] = await sql`select status from transactions where id = ${t.id}`;
    expect(row!.status).toBe("pending");

    const paid = await newTransaction("paid");
    expect(await (await call(paid.code, paid.token)).json()).toEqual({
      status: "paid",
      paidAt: "2026-11-10T01:02:03.000Z",
    });
  });

  it("token kedaluwarsa → 404", async () => {
    const t = await newTransaction("pending");
    await sql`update transactions set access_token_expires_at = now() - interval '1 minute' where id = ${t.id}`;
    expect((await call(t.code, t.token)).status).toBe(404);
  });

  it("getTransactionView: DTO tanpa data donatur/id internal; payment kedaluwarsa → expired", async () => {
    const t = await newTransaction("pending");
    const [m] = await sql`select m.id, m.provider_id from payment_methods m where m.code = 'bni_va' limit 1`;
    if (!m) throw new Error("metode bni_va tidak ada di seed");
    await sql`insert into payments (id, transaction_id, payment_method_id, provider_id, amount, status, provider_ref, instruction, expires_at)
      values (${newId()}, ${t.id}, ${m.id}, ${m.provider_id}, '75000', 'pending', ${`it-${suffix}-${t.code}`},
        ${JSON.stringify({ kind: "virtual_account", bankName: "BNI", vaNumber: "9881234", raw: { x: 1 }, qrImageUrl: "https://api.midtrans.com/qr" })}::jsonb,
        now() - interval '1 minute')`;
    const view = await getTransactionView(t.code, t.token);
    expect(view).not.toBeNull();
    const json = JSON.stringify(view, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    for (const secret of [email, "Nama Rahasia", "081234567890", t.id, donorId, campaignId, "midtrans.com", "raw"]) {
      expect(json).not.toContain(secret);
    }
    expect(view!.payment).toMatchObject({ status: "expired", details: { vaNumber: "9881234", bankName: "BNI" } });
    expect(view!.payment!.steps.some((s) => s.steps.some((x) => x.includes("9881234")))).toBe(true);
    expect(await getTransactionView(t.code, "A".repeat(43))).toBeNull();
  });
});
