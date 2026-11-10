// Helper KHUSUS TEST (P18): donor + transaksi langsung di DB untuk e2e dashboard (Neon `dev`).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import type { SeededDonorSession } from "./donor-session";

config({ path: ".env.local", quiet: true });

function sql() {
  if (process.env.NEON_BRANCH !== "dev") throw new Error("E2E hanya diizinkan bila NEON_BRANCH=dev");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak tersedia untuk e2e");
  return neon(url);
}

export const DASH_CAMPAIGN = "contoh-beasiswa-santri-penghafal-quran";
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function code(): string {
  let s = "";
  for (const b of randomBytes(6)) s += CROCKFORD[b % 32];
  return `TK-261111-${s}`;
}

export interface SeededTrx {
  code: string;
  status: string;
}

/** Donor tertaut ke user sesi + transaksi; `other` = transaksi milik donor lain (uji IDOR). */
export async function seedDashboard(seed: SeededDonorSession, opts: { phone?: string; whatsappOptIn?: boolean; defaultAnonymous?: boolean } = {}) {
  const db = sql();
  const [c] = await db`select id from campaigns where slug = ${DASH_CAMPAIGN}`;
  if (!c) throw new Error("sample seed belum ada");
  const donorId = randomUUID();
  const otherDonorId = randomUUID();
  await db`insert into donors (id, user_id, email, name, phone_e164, whatsapp_opt_in, default_anonymous)
    values (${donorId}, ${seed.userId}, ${seed.email}, ${seed.name}, ${opts.phone ?? null}, ${opts.whatsappOptIn ?? false}, ${opts.defaultAnonymous ?? false})`;
  await db`insert into donors (id, email, name) values (${otherDonorId}, ${`e2e+other-${otherDonorId}@example.test`}, 'Donatur Lain')`;
  const insert = async (donor: string, status: string, amount: number, createdAt: string): Promise<SeededTrx> => {
    const k = code();
    const hash = createHash("sha256").update(randomBytes(32).toString("base64url")).digest();
    await db`insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount, status,
      campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, prayer, paid_at, created_at)
      values (${randomUUID()}, ${k}, ${hash}, now() + interval '7 days', ${c.id}, ${donor}, ${amount}, ${status},
      'Beasiswa Santri Penghafal Quran', 'Donatur E2E', ${seed.email}, 'Semoga berkah', ${status === "paid" ? createdAt : null}, ${createdAt})`;
    return { code: k, status };
  };
  const paid = await insert(donorId, "paid", 150_000, "2026-03-05T02:00:00Z");
  const paidOld = await insert(donorId, "paid", 75_000, "2025-08-01T02:00:00Z");
  const expired = await insert(donorId, "expired", 20_000, "2026-04-01T02:00:00Z");
  const created = await insert(donorId, "created", 50_000, "2026-11-10T02:00:00Z");
  const other = await insert(otherDonorId, "paid", 99_000, "2026-05-01T02:00:00Z");
  return { donorId, otherDonorId, paid, paidOld, expired, created, other };
}

/** Donor tamu (tanpa user) ber-email korban dengan nama/WA/opt-in yang ditanam. */
export async function plantGuestDonor(email: string): Promise<string> {
  const id = randomUUID();
  await sql()`insert into donors (id, email, name, phone_e164, whatsapp_opt_in, default_anonymous)
    values (${id}, ${email}, 'Penyusup', '+6281299990000', true, true)`;
  return id;
}

export async function getDonorProfile(donorId: string) {
  const [row] = await sql()`select name, phone_e164, whatsapp_opt_in, default_anonymous from donors where id = ${donorId}`;
  return row;
}

export async function cleanupDashboard(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = sql();
  await db`delete from payments where transaction_id in (select id from transactions where donor_id = any(${ids}::uuid[]))`;
  await db`delete from transactions where donor_id = any(${ids}::uuid[])`;
  await db`delete from audit_logs where entity_id = any(${ids}::text[])`;
  await db`delete from donors where id = any(${ids}::uuid[])`;
}
