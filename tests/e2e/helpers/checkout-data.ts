// Helper KHUSUS TEST: data paket & pembersihan transaksi checkout e2e (hanya Neon branch `dev`).
import { randomInt } from "node:crypto";
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
  // Satu statement (CTE) + retry: polling status / job yang masih berjalan bisa menyisipkan
  // payment_events baru di antara dua DELETE terpisah (FK payment_events → payments).
  for (let attempt = 1; ; attempt++) {
    try {
      await db`with trx as (select id from transactions where donor_email_snapshot = any(${emails}::citext[])),
        pay as (select id from payments where transaction_id in (select id from trx)),
        ev as (delete from payment_events where payment_id in (select id from pay)),
        nl as (delete from notification_logs where transaction_id in (select id from trx))
        delete from payments where id in (select id from pay)`;
      await db`delete from notification_logs where transaction_id in (select id from transactions
        where donor_email_snapshot = any(${emails}::citext[]))`;
      await db`delete from transactions where donor_email_snapshot = any(${emails}::citext[])`;
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
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

/**
 * Seed transaksi + payment langsung di DB (KHUSUS TEST, branch dev) untuk state yang tidak bisa
 * dibuat lewat UI tanpa provider: kedaluwarsa, paid (simulasi hasil webhook), pending tanpa charge.
 * Tidak ada charge Midtrans yang dibuat. Dibersihkan via cleanupCheckout([email]).
 */
export async function seedTransaction(opts: {
  slug: string;
  email: string;
  status: "pending" | "paid";
  method?: string;
  expiresInMinutes?: number;
  instruction?: Record<string, unknown>;
}): Promise<{ code: string; token: string; transactionId: string; paymentId: string }> {
  const { randomBytes, createHash, randomUUID } = await import("node:crypto");
  const db = sql();
  const token = randomBytes(32).toString("base64url");
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const rand = Array.from(randomBytes(6), (b) => alphabet[b % 32]).join("");
  const code = `TK-000000-${rand}`;
  const [c] = await db`select id, title from campaigns where slug = ${opts.slug}`;
  const [m] = await db`select id, provider_id from payment_methods where code = ${opts.method ?? "bni_va"} limit 1`;
  if (!c || !m) throw new Error("campaign/metode seed tidak ditemukan");
  const donorId = randomUUID();
  await db`insert into donors (id, email, name) values (${donorId}, ${opts.email}, 'Donatur Uji Seed')
    on conflict do nothing`;
  const [donor] = await db`select id from donors where email = ${opts.email}`;
  const transactionId = randomUUID();
  const paymentId = randomUUID();
  const paidAt = opts.status === "paid" ? new Date() : null;
  await db`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount,
      status, paid_at, campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot)
    values (${transactionId}, ${code}, ${createHash("sha256").update(token).digest()}, now() + interval '1 day', ${c.id},
      ${donor!.id}, '50000', ${opts.status}, ${paidAt}, ${c.title}, 'Donatur Uji Seed', ${opts.email})`;
  const instruction = opts.instruction ?? { kind: "virtual_account", bankName: "BNI", vaNumber: "9880000000000001" };
  await db`insert into payments (id, transaction_id, payment_method_id, provider_id, amount, status, provider_ref, instruction,
      expires_at, paid_at)
    values (${paymentId}, ${transactionId}, ${m.id}, ${m.provider_id}, '50000', ${opts.status}, ${`e2e-${paymentId}`},
      ${JSON.stringify(instruction)}::jsonb, now() + make_interval(mins => ${opts.expiresInMinutes ?? 60}), ${paidAt})`;
  return { code, token, transactionId, paymentId };
}

/** KHUSUS TEST: simulasikan hasil applyVerifiedStatus pada baris seed (bukan charge nyata). */
export async function markSeededPaid(transactionId: string, paymentId: string): Promise<void> {
  const db = sql();
  await db`update payments set status = 'paid', paid_at = now() where id = ${paymentId}`;
  // P19: nomor kuitansi uji (tahun 1998, tidak bentrok dengan receipt_counters sungguhan).
  const receiptNo = `KW/1998/${String(randomInt(1_000_000)).padStart(6, "0")}`;
  await db`update transactions set status = 'paid', paid_at = now(), receipt_no = ${receiptNo}, receipt_issued_at = now()
    where id = ${transactionId}`;
}
