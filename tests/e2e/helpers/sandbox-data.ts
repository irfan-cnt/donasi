// Helper KHUSUS suite @sandbox (P15): campaign uji, baca status DB, Midtrans SANDBOX, QStash JWT.
// Hanya Neon branch `dev` + kunci SB-. Tidak pernah mengubah status pembayaran ke `paid` —
// paid hanya lewat webhook/Get Status di aplikasi (BR-18). Tidak mencetak secret.
import { createHash, createHmac, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export const EMAIL_PREFIX = "e2e-sandbox+";
export const OPEN_SLUG = "e2e-sandbox-terbuka";
export const FIXED_SLUG = "e2e-sandbox-paket";

function sql() {
  if (process.env.NEON_BRANCH !== "dev")
    throw new Error("Suite sandbox hanya untuk NEON_BRANCH=dev");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak tersedia");
  return neon(url);
}

function serverKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!key.startsWith("SB-Mid-server-") || process.env.MIDTRANS_IS_PRODUCTION === "true") {
    throw new Error("Suite sandbox wajib memakai kunci Midtrans SANDBOX");
  }
  return key;
}

const authHeader = () => `Basic ${Buffer.from(`${serverKey()}:`).toString("base64")}`;

export const newEmail = () => `${EMAIL_PREFIX}${randomUUID()}@example.test`;

/** Campaign "[UJI SANDBOX]" (open & fixed) — dibuat sekali, dipakai ulang; total seed tidak tersentuh. */
export async function ensureTestCampaigns(): Promise<void> {
  const db = sql();
  const [cat] =
    await db`select category_id, featured_image_url, featured_image_alt from campaigns where slug = 'contoh-paket-sembako-dhuafa'`;
  if (!cat) throw new Error("Kategori seed tidak ditemukan (pnpm db:seed)");
  const defs = [
    {
      slug: OPEN_SLUG,
      title: "[UJI SANDBOX] Donasi Nominal Bebas",
      type: "open",
      opts: [["suggested", null, 25000]],
    },
    {
      slug: FIXED_SLUG,
      title: "[UJI SANDBOX] Donasi Paket",
      type: "fixed",
      opts: [
        ["package", "Paket uji A", 15000],
        ["package", "Paket uji B", 30000],
      ],
    },
  ] as const;
  for (const d of defs) {
    const id = randomUUID();
    const rows =
      await db`insert into campaigns (id, category_id, title, slug, short_description, description_html,
        target_amount, amount_type, min_amount, status, published_at, featured_image_url, featured_image_alt)
      values (${id}, ${cat.category_id}, ${d.title}, ${d.slug}, 'Campaign khusus uji E2E sandbox Midtrans (P15). Bukan program nyata.',
        '<p>Campaign khusus uji E2E sandbox Midtrans. Bukan program nyata.</p>', 1000000, ${d.type}, 10000, 'published', now(), ${cat.featured_image_url}, ${cat.featured_image_alt})
      on conflict (slug) do nothing returning id`;
    if (!rows[0]) continue;
    for (const [i, [kind, label, amount]] of d.opts.entries()) {
      await db`insert into campaign_amount_options (id, campaign_id, kind, label, amount, sort_order, is_active)
        values (${randomUUID()}, ${id}, ${kind}, ${label}, ${amount}, ${i}, true)`;
    }
  }
}

export async function campaignTotals(slug: string): Promise<{ collected: bigint; donors: number }> {
  const [r] =
    await sql()`select collected_amount::text c, donor_count d from campaigns where slug = ${slug}`;
  return { collected: BigInt(r!.c as string), donors: Number(r!.d) };
}

export async function isMethodActive(code: string): Promise<boolean> {
  const [r] = await sql()`select is_active from payment_methods where code = ${code}`;
  return Boolean(r?.is_active);
}

export interface PaymentRow {
  id: string;
  status: string;
  trxStatus: string;
  method: string;
  amount: bigint;
  instruction: Record<string, string>;
}

export async function payments(code: string): Promise<PaymentRow[]> {
  const rows =
    await sql()`select p.id, p.status, t.status trx_status, m.code method, p.amount::text amount, p.instruction
    from payments p join transactions t on t.id = p.transaction_id join payment_methods m on m.id = p.payment_method_id
    where t.code = ${code} order by p.created_at`;
  return rows.map((r) => ({
    id: r.id as string,
    status: r.status as string,
    trxStatus: r.trx_status as string,
    method: r.method as string,
    amount: BigInt(r.amount as string),
    instruction: (r.instruction ?? {}) as Record<string, string>,
  }));
}

/** Cuplikan payment_events tanpa payload (tanpa PII). */
export async function eventSnippet(paymentId: string) {
  return sql()`select event_type, verification, result, status_reported from payment_events
    where payment_id = ${paymentId} order by received_at`;
}

/** KHUSUS uji skenario 5: majukan expires_at payment uji ke masa lalu (status tidak diubah). */
export async function backdateExpiry(paymentId: string): Promise<void> {
  await sql()`update payments set expires_at = now() - interval '10 minutes', last_checked_at = null
    where id = ${paymentId} and status = 'pending' and transaction_id in
      (select id from transactions where donor_email_snapshot like ${EMAIL_PREFIX + "%@example.test"})`;
}

export async function midtransStatus(orderId: string): Promise<Record<string, string>> {
  const res = await fetch(
    `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`,
    {
      headers: { Accept: "application/json", Authorization: authHeader() },
    },
  );
  return (await res.json()) as Record<string, string>;
}

/** Charge langsung ke Midtrans SANDBOX untuk mencatat ketersediaan kanal (lalu di-expire). */
export async function probeChannel(
  body: Record<string, unknown>,
): Promise<{ statusCode: string; message: string }> {
  const orderId = `e2e-sbx-probe-${Date.now()}`;
  const res = await fetch("https://api.sandbox.midtrans.com/v2/charge", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      ...body,
      transaction_details: { order_id: orderId, gross_amount: 10000 },
    }),
  });
  const j = (await res.json()) as Record<string, string>;
  if (j.transaction_status === "pending") await expireCharge(orderId);
  return { statusCode: j.status_code ?? String(res.status), message: j.status_message ?? "" };
}

export async function expireCharge(orderId: string): Promise<void> {
  await fetch(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/expire`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: authHeader() },
  }).catch(() => undefined);
}

/** Notifikasi Midtrans bertanda tangan benar (SHA512) dari status API — untuk uji kirim ulang. */
export async function signedNotification(orderId: string): Promise<string> {
  const s = await midtransStatus(orderId);
  const signature = createHash("sha512")
    .update(`${s.order_id}${s.status_code}${s.gross_amount}${serverKey()}`)
    .digest("hex");
  return JSON.stringify({
    transaction_time: s.transaction_time,
    transaction_status: s.transaction_status,
    transaction_id: s.transaction_id,
    status_message: "midtrans payment notification",
    status_code: s.status_code,
    signature_key: signature,
    settlement_time: s.settlement_time,
    payment_type: s.payment_type,
    order_id: s.order_id,
    merchant_id: s.merchant_id,
    gross_amount: s.gross_amount,
    fraud_status: s.fraud_status,
    currency: s.currency,
  });
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** JWT QStash (HS256) yang kompatibel dengan Receiver @upstash/qstash, diikat ke URL + body. */
export function signQStash(url: string, body: string): string {
  const key = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!key) throw new Error("QSTASH_CURRENT_SIGNING_KEY tidak tersedia");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: "Upstash",
      sub: url,
      exp: now + 300,
      nbf: now - 10,
      iat: now,
      jti: randomUUID(),
      body: b64url(createHash("sha256").update(body).digest()),
    }),
  );
  const sig = b64url(createHmac("sha256", key).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/** Akhir suite: expire charge sandbox yang masih pending milik transaksi uji. Baris dibiarkan (bukti). */
export async function expireLeftoverCharges(): Promise<number> {
  const rows =
    await sql()`select p.id from payments p join transactions t on t.id = p.transaction_id
    where t.donor_email_snapshot like ${EMAIL_PREFIX + "%@example.test"} and p.status = 'pending'`;
  for (const r of rows) await expireCharge(r.id as string);
  return rows.length;
}
