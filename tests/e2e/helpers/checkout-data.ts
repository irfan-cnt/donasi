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
  // Charge sandbox yang dibuat e2e di-expire dulu (Midtrans sandbox saja), lalu baris dihapus.
  const pending = await db`select p.id from payments p join transactions t on t.id = p.transaction_id
    where t.donor_email_snapshot = any(${emails}::citext[]) and p.status = 'pending'`;
  for (const row of pending) await expireSandboxCharge(row.id as string);
  await db`delete from payment_events where payment_id in (select p.id from payments p
    join transactions t on t.id = p.transaction_id where t.donor_email_snapshot = any(${emails}::citext[]))`;
  await db`delete from payments where transaction_id in (select id from transactions
    where donor_email_snapshot = any(${emails}::citext[]))`;
  await db`delete from transactions where donor_email_snapshot = any(${emails}::citext[])`;
  await db`delete from donors where email = any(${emails}::citext[]) and user_id is null`;
}

/** Expire charge di Midtrans SANDBOX (hanya kunci SB-; tidak pernah ke production). */
export async function expireSandboxCharge(orderId: string): Promise<void> {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!key.startsWith("SB-Mid-server-") || process.env.MIDTRANS_IS_PRODUCTION === "true") return;
  await fetch(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/expire`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
  }).catch(() => undefined);
}

export function sandboxConfigured(): boolean {
  return (process.env.MIDTRANS_SERVER_KEY ?? "").startsWith("SB-Mid-server-") && process.env.MIDTRANS_IS_PRODUCTION !== "true";
}
