// Helper KHUSUS TEST: data paket & pembersihan transaksi checkout e2e (hanya Neon branch `dev`).
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

function sql() {
  if (process.env.NEON_BRANCH !== "dev") {
    throw new Error("E2E hanya diizinkan bila NEON_BRANCH=dev");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak tersedia untuk e2e");
  return neon(url);
}

export async function getActivePackages(slug: string): Promise<{ label: string; amount: bigint }[]> {
  const rows = await sql()`
    select coalesce(o.label, '') as label, o.amount::text as amount
    from campaign_amount_options o join campaigns c on c.id = o.campaign_id
    where c.slug = ${slug} and o.kind = 'package' and o.is_active
    order by o.sort_order, o.amount`;
  return rows.map((r) => ({ label: r.label as string, amount: BigInt(r.amount as string) }));
}

export async function getTransactionAmount(code: string): Promise<bigint | null> {
  const rows = await sql()`select amount::text as amount from transactions where code = ${code}`;
  return rows[0] ? BigInt(rows[0].amount as string) : null;
}

/** Hapus transaksi berdasarkan email snapshot uji, lalu donor tamu ber-email itu. */
export async function cleanupCheckout(emails: string[]): Promise<void> {
  if (!emails.length) return;
  const db = sql();
  await db`delete from transactions where donor_email_snapshot = any(${emails}::citext[])`;
  await db`delete from donors where email = any(${emails}::citext[]) and user_id is null`;
}
