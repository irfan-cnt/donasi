/**
 * createDonation terhadap DB nyata (branch Neon `dev` + sample seed). Hanya berjalan bila
 * NEON_BRANCH=dev. Semua baris yang dibuat (transaksi & donor tamu ber-email unik) dihapus
 * di afterAll — seed & data lain tidak disentuh.
 */
import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "@/lib/logger";
import { createDonation, getTransactionByAccess } from "@/server/services/donation-service";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const FIXED = "contoh-paket-sembako-dhuafa";
const OTHER_FIXED = "contoh-paket-hygiene-korban-banjir";
const OPEN = "contoh-beasiswa-santri-penghafal-quran";

describe.skipIf(!ENABLED)("createDonation (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const log = createLogger({ test: "create-donation" });
  const createdTx: string[] = [];
  const emails: string[] = [];
  let ownPackage: { id: string; amount: string };
  let foreignPackageId: string;

  const email = () => {
    const e = `it+${randomUUID()}@example.test`;
    emails.push(e);
    return e;
  };
  const ctx = () => ({ sessionDonor: null, ip: "203.0.113.10", userAgent: "vitest", log });

  beforeAll(async () => {
    const own = await sql`
      select o.id, o.amount::text as amount from campaign_amount_options o join campaigns c on c.id = o.campaign_id
      where c.slug = ${FIXED} and o.kind = 'package' and o.is_active order by o.sort_order limit 1`;
    const foreign = await sql`
      select o.id from campaign_amount_options o join campaigns c on c.id = o.campaign_id
      where c.slug = ${OTHER_FIXED} and o.kind = 'package' limit 1`;
    if (!own[0] || !foreign[0]) throw new Error("sample seed belum ada (pnpm db:seed:sample)");
    ownPackage = { id: own[0].id as string, amount: own[0].amount as string };
    foreignPackageId = foreign[0].id as string;
  });

  afterAll(async () => {
    if (createdTx.length) await sql`delete from transactions where id = any(${createdTx}::uuid[])`;
    if (emails.length) await sql`delete from donors where email = any(${emails}::citext[]) and user_id is null`;
  });

  it("menolak optionId paket milik campaign lain (AC-04.4 → 400)", async () => {
    const r = await createDonation(
      { slug: FIXED, optionId: foreignPackageId, amount: "10000", name: "Uji", email: email() },
      ctx(),
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.status).toBe(400);
    expect(!r.ok && r.reason).toBe("invalid_option");
  });

  it("memakai nominal paket dari DB walau amount dimanipulasi (AC-04.5)", async () => {
    const r = await createDonation(
      { slug: FIXED, optionId: ownPackage.id, amount: "1000", name: "Uji Paket", email: email() },
      ctx(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    createdTx.push(r.transactionId);
    const [row] = await sql`select amount::text as amount, amount_option_id, status from transactions where id = ${r.transactionId}`;
    expect(row!.amount).toBe(ownPackage.amount);
    expect(row!.amount_option_id).toBe(ownPackage.id);
    expect(row!.status).toBe("created");
  });

  it("menyimpan access token sebagai hash saja + snapshot; akses butuh token sah", async () => {
    const e = email();
    const r = await createDonation(
      { slug: OPEN, amount: "123456", name: "", anonymous: "on", email: e, prayer: "Semoga berkah" },
      ctx(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    createdTx.push(r.transactionId);
    expect(r.code).toMatch(/^TK-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(r.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const [row] = await sql`
      select encode(access_token_hash, 'hex') as hash, amount::text as amount, donor_name_snapshot,
             donor_email_snapshot, is_anonymous, prayer, ip_hash is not null as has_ip,
             access_token_expires_at > now() + interval '6 days' as ttl_ok
      from transactions where id = ${r.transactionId}`;
    expect(row!.hash).toBe(createHash("sha256").update(r.accessToken).digest("hex"));
    expect(row!.hash).not.toContain(Buffer.from(r.accessToken).toString("hex"));
    expect(row!.amount).toBe("123456");
    expect(row!.donor_name_snapshot).toBe("Hamba Allah");
    expect(row!.donor_email_snapshot).toBe(e);
    expect(row!.is_anonymous).toBe(true);
    expect(row!.has_ip).toBe(true);
    expect(row!.ttl_ok).toBe(true);

    expect(await getTransactionByAccess(OPEN, r.code, r.accessToken)).toMatchObject({ code: r.code, amount: 123456n });
    const wrong = "A".repeat(43);
    expect(await getTransactionByAccess(OPEN, r.code, wrong)).toBeNull();
    expect(await getTransactionByAccess(FIXED, r.code, r.accessToken)).toBeNull();
  });

  it("menolak campaign yang tidak menerima donasi (BR-03) dan draft", async () => {
    const paused = await createDonation(
      { slug: "contoh-dana-darurat-kemanusiaan", amount: "50000", name: "Uji", email: email() },
      ctx(),
    );
    expect(!paused.ok && paused.reason).toBe("not_accepting");
    const draft = await createDonation(
      { slug: "contoh-ambulans-gratis-dhuafa", amount: "50000", name: "Uji", email: email() },
      ctx(),
    );
    expect(!draft.ok && draft.reason).toBe("not_found");
  });

  it("menolak nominal di atas batas (max campaign/platform)", async () => {
    const r = await createDonation(
      { slug: OPEN, amount: "9999999999999", name: "Uji", email: email() },
      ctx(),
    );
    expect(!r.ok && r.status).toBe(400);
    expect(!r.ok && r.fieldErrors.amount).toMatch(/Maksimal/);
  });
});
