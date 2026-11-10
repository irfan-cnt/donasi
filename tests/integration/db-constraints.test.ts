/**
 * Constraint DB terhadap database nyata (branch Neon dev, sudah dimigrasi).
 * Dilewati bila DATABASE_URL tidak di-set. Jalankan: `pnpm test:integration`.
 * Setiap kasus berjalan di transaksi yang di-ROLLBACK — tidak meninggalkan data.
 */
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("db constraints (integration)", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL });
  });
  afterAll(async () => {
    await pool?.end();
  });

  /** Jalankan `fn` dalam transaksi yang selalu di-rollback. */
  async function inRollback(fn: (c: PoolClient) => Promise<void>) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  }

  async function expectSqlError(c: PoolClient, sql: string, params: unknown[], code: string) {
    await c.query("SAVEPOINT sp");
    await expect(c.query(sql, params)).rejects.toMatchObject({ code });
    await c.query("ROLLBACK TO SAVEPOINT sp");
  }

  /** Fixture minimal: kategori, campaign, donor, provider, metode, transaksi. */
  async function seed(c: PoolClient) {
    const ids = {
      category: newId(),
      campaign: newId(),
      donor: newId(),
      provider: newId(),
      method: newId(),
      tx: newId(),
    };
    await c.query(`INSERT INTO campaign_categories (id, slug, name) VALUES ($1, $2, 'Tes')`, [
      ids.category,
      `tes-${ids.category.slice(-8)}`,
    ]);
    await c.query(
      `INSERT INTO campaigns (id, category_id, title, slug, short_description, description_html)
       VALUES ($1, $2, 'Campaign uji integrasi', $3, 'Ringkas', '<p>x</p>')`,
      [ids.campaign, ids.category, `uji-${ids.campaign.slice(-8)}`],
    );
    await c.query(`INSERT INTO donors (id, email, name) VALUES ($1, $2, 'Donor Uji')`, [
      ids.donor,
      `uji-${ids.donor}@example.test`,
    ]);
    await c.query(
      `INSERT INTO payment_providers (id, code, name) VALUES ($1, 'midtrans', 'Midtrans')
       ON CONFLICT (code) DO NOTHING`,
      [ids.provider],
    );
    const { rows } = await c.query<{ id: string }>(
      `SELECT id FROM payment_providers WHERE code = 'midtrans'`,
    );
    ids.provider = rows[0]!.id;
    await c.query(
      `INSERT INTO payment_methods (id, provider_id, code, provider_channel, type, display_name)
       VALUES ($1, $2, $3, 'qris', 'qris', 'QRIS')`,
      [ids.method, ids.provider, `qris-${ids.method.slice(-8)}`],
    );
    await c.query(
      `INSERT INTO transactions (id, code, access_token_hash, access_token_expires_at, campaign_id,
         donor_id, amount, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot)
       VALUES ($1, 'TK-261110-ABCDEF', '\\x00', now() + interval '1 day', $2, $3, 50000,
         'Campaign uji integrasi', 'Donor Uji', 'uji@example.test')`,
      [ids.tx, ids.campaign, ids.donor],
    );
    return ids;
  }

  const insertPayment = `INSERT INTO payments
    (id, transaction_id, payment_method_id, provider_id, provider_ref, amount, status)
    VALUES ($1, $2, $3, $4, $5, 50000, $6)`;

  it("menolak duplikat (provider_id, provider_ref)", () =>
    inRollback(async (c) => {
      const s = await seed(c);
      await c.query(insertPayment, [newId(), s.tx, s.method, s.provider, "REF-1", "expired"]);
      await expectSqlError(
        c,
        insertPayment,
        [newId(), s.tx, s.method, s.provider, "REF-1", "failed"],
        "23505",
      );
    }));

  it("menolak dua payment pending untuk satu transaksi (BR-11)", () =>
    inRollback(async (c) => {
      const s = await seed(c);
      await c.query(insertPayment, [newId(), s.tx, s.method, s.provider, "REF-A", "pending"]);
      await expectSqlError(
        c,
        insertPayment,
        [newId(), s.tx, s.method, s.provider, "REF-B", "pending"],
        "23505",
      );
    }));

  it("menolak nominal transaksi < 1000 (BR-08)", () =>
    inRollback(async (c) => {
      const s = await seed(c);
      await expectSqlError(
        c,
        `UPDATE transactions SET amount = 999 WHERE id = $1`,
        [s.tx],
        "23514",
      );
    }));

  it("menolak hapus campaign yang punya transaksi (AC-24.1)", () =>
    inRollback(async (c) => {
      const s = await seed(c);
      await expectSqlError(c, `DELETE FROM campaigns WHERE id = $1`, [s.campaign], "23001"); // ON DELETE RESTRICT → restrict_violation
    }));
});
