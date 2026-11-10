/**
 * P18 — klaim transaksi tamu, IDOR dashboard donor, paginasi keyset, profil & anonimisasi akun,
 * terhadap DB nyata (Neon `dev`). Tidak ada email/WA yang dikirim (tidak ada notifikasi dipicu).
 * Semua baris uji (users/donors/transactions/audit_logs ber-email unik) dihapus di afterAll.
 */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { generateSessionToken, sha256 } from "@/lib/security/crypto";
import { generateTransactionCode } from "@/lib/transaction-code";
import { decodeDonorCursor, encodeDonorCursor } from "@/lib/validation/donor";
import {
  continuePayment,
  deleteDonorAccount,
  ensureDonorAccount,
  getDonorDashboard,
  getDonorTransactionDetail,
  getDonorTransactionList,
  saveDonorProfile,
} from "@/server/services/donor-account-service";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;
const CAMPAIGN = "contoh-beasiswa-santri-penghafal-quran";

describe.skipIf(!ENABLED)("dashboard donor & klaim (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const userIds: string[] = [];
  const donorIds = new Set<string>();
  let campaignId: string;

  const newEmail = () => `it-p18+${randomUUID()}@example.test`;

  async function insertUser(email: string) {
    const id = randomUUID();
    userIds.push(id);
    await sql`insert into users (id, name, email, email_verified) values (${id}, 'Uji P18', ${email}, now())`;
    return id;
  }

  async function insertGuestDonor(email: string) {
    const [row] = await sql`insert into donors (id, email, name) values (${newId()}, ${email}, 'Tamu Uji') returning id`;
    donorIds.add(row!.id as string);
    return row!.id as string;
  }

  async function insertTrx(donorId: string, emailSnapshot: string, status = "paid", amount = 50_000, createdAt?: Date) {
    const code = generateTransactionCode();
    const paid = status === "paid";
    const at = (createdAt ?? new Date()).toISOString();
    const [row] = await sql`
      insert into transactions (id, code, access_token_hash, access_token_expires_at, campaign_id, donor_id, amount, status,
        campaign_title_snapshot, donor_name_snapshot, donor_email_snapshot, paid_at, created_at)
      values (${newId()}, ${code}, ${sha256(generateSessionToken())}, now() + interval '7 days', ${campaignId}, ${donorId}, ${amount},
        ${status}, 'Program Uji P18', 'Tamu Uji', ${emailSnapshot}, ${paid ? at : null}, ${at})
      returning id, code`;
    return { id: row!.id as string, code: row!.code as string };
  }

  const auditCount = async (donorId: string, action: string) => {
    const [r] = await sql`select count(*)::int as n from audit_logs where entity_id = ${donorId} and action = ${action}`;
    return r!.n as number;
  };

  beforeAll(async () => {
    const [c] = await sql`select id from campaigns where slug = ${CAMPAIGN}`;
    if (!c) throw new Error("sample seed belum ada (pnpm db:seed:sample)");
    campaignId = c.id as string;
  });

  afterAll(async () => {
    const ids = [...donorIds];
    if (ids.length) {
      await sql`delete from transactions where donor_id = any(${ids}::uuid[])`;
      await sql`delete from audit_logs where entity_id = any(${ids}::text[])`;
    }
    if (userIds.length) {
      const rows = await sql`select id from donors where user_id = any(${userIds}::uuid[])`;
      const more = rows.map((r) => r.id as string);
      if (more.length) {
        await sql`delete from transactions where donor_id = any(${more}::uuid[])`;
        await sql`delete from audit_logs where entity_id = any(${more}::text[])`;
        await sql`delete from donors where id = any(${more}::uuid[])`;
      }
    }
    if (ids.length) await sql`delete from donors where id = any(${ids}::uuid[])`;
    if (userIds.length) await sql`delete from users where id = any(${userIds}::uuid[])`;
  });

  it("klaim: email sama (beda huruf besar/kecil) → transaksi tamu muncul + audit (AC-11.1, AC-11.3)", async () => {
    const email = newEmail();
    const guest = await insertGuestDonor(email.toUpperCase());
    const trx = await insertTrx(guest, email.toUpperCase(), "paid", 125_000);
    const userId = await insertUser(email);

    const donor = await ensureDonorAccount({ id: userId, email: email.toUpperCase(), name: "Uji" });
    expect(donor?.id).toBe(guest); // baris tamu ditautkan, bukan diduplikasi
    const dash = await getDonorDashboard(guest);
    expect(dash.summary.totalPaid).toBe(125_000n);
    expect(dash.summary.paidCount).toBe(1);
    expect(dash.recent.map((r) => r.code)).toContain(trx.code);
    expect(await auditCount(guest, "donor.guest_transactions_claimed")).toBe(1);

    // Idempoten: login ulang tidak mengubah apa pun dan tidak menulis audit baru.
    const again = await ensureDonorAccount({ id: userId, email, name: "Uji" });
    expect(again?.id).toBe(guest);
    expect(await auditCount(guest, "donor.guest_transactions_claimed")).toBe(1);
  });

  it("klaim: field tamu yang ditanam (nama/WA/opt-in/anonim) direset saat ditautkan (M1)", async () => {
    const email = newEmail();
    const [g] = await sql`insert into donors (id, email, name, phone_e164, whatsapp_opt_in, default_anonymous)
      values (${newId()}, ${email}, 'Penyusup', '+6281299990000', true, true) returning id`;
    donorIds.add(g!.id as string);
    const userId = await insertUser(email);
    const donor = await ensureDonorAccount({ id: userId, email, name: "Pemilik Asli" });
    expect(donor).toMatchObject({ id: g!.id, name: "Pemilik Asli", phoneE164: null, whatsappOptIn: false, defaultAnonymous: false });
  });

  it("klaim: transaksi ber-snapshot email sama pada donor tamu lain dipindah", async () => {
    const email = newEmail();
    const otherGuest = await insertGuestDonor(newEmail());
    const trx = await insertTrx(otherGuest, email, "pending", 20_000);
    const userId = await insertUser(email);
    const donor = await ensureDonorAccount({ id: userId, email, name: "Uji" });
    donorIds.add(donor!.id);
    const [row] = await sql`select donor_id from transactions where id = ${trx.id}`;
    expect(row!.donor_id).toBe(donor!.id);
    const [audit] = await sql`select metadata from audit_logs where entity_id = ${donor!.id} and action = 'donor.guest_transactions_claimed'`;
    expect((audit!.metadata as { movedTransactions: number }).movedTransactions).toBe(1);
  });

  it("klaim: email berbeda → tidak terklaim (AC-11.2)", async () => {
    const guestEmail = newEmail();
    const guest = await insertGuestDonor(guestEmail);
    const trx = await insertTrx(guest, guestEmail);
    const email = newEmail();
    const userId = await insertUser(email);
    const donor = await ensureDonorAccount({ id: userId, email, name: "Uji" });
    donorIds.add(donor!.id);
    expect(donor!.id).not.toBe(guest);
    const [row] = await sql`select donor_id from transactions where id = ${trx.id}`;
    expect(row!.donor_id).toBe(guest);
    expect((await getDonorDashboard(donor!.id)).summary.paidCount).toBe(0);
    expect(await auditCount(donor!.id, "donor.guest_transactions_claimed")).toBe(0);
  });

  it("IDOR: kode transaksi donor lain → null (404) untuk detail & lanjut bayar (AC-13.1)", async () => {
    const a = await insertGuestDonor(newEmail());
    const b = await insertGuestDonor(newEmail());
    const trxA = await insertTrx(a, "x@example.test", "pending");
    const [before] = await sql`select access_token_hash from transactions where id = ${trxA.id}`;

    expect(await getDonorTransactionDetail(b, trxA.code)).toBeNull();
    expect(await continuePayment(b, trxA.code)).toBeNull();
    const [after] = await sql`select access_token_hash from transactions where id = ${trxA.id}`;
    expect(Buffer.from(after!.access_token_hash as Uint8Array).equals(Buffer.from(before!.access_token_hash as Uint8Array))).toBe(true);
    const list = await getDonorTransactionList({ donorId: b });
    expect(list.items.map((i) => i.code)).not.toContain(trxA.code);

    // Pemilik: detail ada, lanjut bayar menerbitkan token baru (hash saja di DB).
    const own = await getDonorTransactionDetail(a, trxA.code);
    expect(own?.trx.code).toBe(trxA.code);
    expect(own?.timeline[0]?.label).toBe("Donasi dibuat");
    const url = await continuePayment(a, trxA.code);
    expect(url).toMatch(new RegExp(`^/transaksi/${trxA.code}/instruksi\\?t=[A-Za-z0-9_-]{43}$`));
    const token = new URL(url!, "http://x").searchParams.get("t")!;
    const [rotated] = await sql`select access_token_hash from transactions where id = ${trxA.id}`;
    expect(Buffer.from(rotated!.access_token_hash as Uint8Array).equals(sha256(token))).toBe(true);
  });

  it("riwayat: filter status & tahun + keyset 20 per halaman (AC-13.2)", async () => {
    const d = await insertGuestDonor(newEmail());
    const base = Date.parse("2025-06-01T03:00:00Z");
    for (let i = 0; i < 23; i++) await insertTrx(d, "y@example.test", "paid", 10_000 + i, new Date(base + i * 60_000));
    await insertTrx(d, "y@example.test", "expired", 5_000, new Date("2026-02-01T03:00:00Z"));
    await insertTrx(d, "y@example.test", "created", 6_000, new Date("2024-12-31T17:30:00Z")); // 1 Jan 2025 WIB

    const p1 = await getDonorTransactionList({ donorId: d });
    expect(p1.items).toHaveLength(20);
    expect(p1.years).toEqual([2026, 2025]);
    expect(p1.prev).toBeNull();
    const cursor = decodeDonorCursor(encodeDonorCursor(p1.next!));
    const p2 = await getDonorTransactionList({ donorId: d, after: cursor });
    expect(p2.items).toHaveLength(5);
    expect(p2.next).toBeNull();
    expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(25);
    const back = await getDonorTransactionList({ donorId: d, before: p2.prev });
    expect(back.items.map((i) => i.id)).toEqual(p1.items.map((i) => i.id));

    expect((await getDonorTransactionList({ donorId: d, status: "expired" })).items).toHaveLength(1);
    const pending = await getDonorTransactionList({ donorId: d, status: "pending" });
    expect(pending.items.map((i) => i.status)).toEqual(["created"]);
    expect((await getDonorTransactionList({ donorId: d, year: 2026 })).items).toHaveLength(1);
    const y25 = await getDonorTransactionList({ donorId: d, year: 2025 });
    expect(y25.items).toHaveLength(20);
    expect((await getDonorTransactionList({ donorId: d, year: 2025, after: y25.next })).items).toHaveLength(4);
  });

  it("profil disimpan + audit tanpa PII; hapus akun menganonimkan donor & snapshot", async () => {
    const email = newEmail();
    const userId = await insertUser(email);
    const donor = await ensureDonorAccount({ id: userId, email, name: "Uji" });
    donorIds.add(donor!.id);
    const trx = await insertTrx(donor!.id, email, "paid");
    const open = await insertTrx(donor!.id, email, "pending");

    await saveDonorProfile(
      donor!.id,
      { name: "Nama Baru", phoneE164: "+6281234567890", whatsappOptIn: false, defaultAnonymous: true },
      { ip: null, ua: "vitest" },
    );
    const [p] = await sql`select name, phone_e164, whatsapp_opt_in, default_anonymous from donors where id = ${donor!.id}`;
    expect(p).toMatchObject({ name: "Nama Baru", phone_e164: "+6281234567890", whatsapp_opt_in: false, default_anonymous: true });
    const [audit] = await sql`select metadata::text as m from audit_logs where entity_id = ${donor!.id} and action = 'donor.profile_updated'`;
    expect(audit!.m).not.toContain("6281234567890");
    expect(audit!.m).not.toContain("Nama Baru");

    expect(await deleteDonorAccount({ donorId: donor!.id, userId: "00000000-0000-0000-0000-000000000000", ip: null, ua: null })).toBe(false);
    expect(await deleteDonorAccount({ donorId: donor!.id, userId, ip: null, ua: null })).toBe(true);
    const [d] = await sql`select name, email::text as email, phone_e164, user_id, anonymized_at from donors where id = ${donor!.id}`;
    expect(d!.name).toBe("Donatur Terhapus");
    expect(d!.email).toBe(`deleted+${donor!.id}@invalid`);
    expect(d!.phone_e164).toBeNull();
    expect(d!.user_id).toBeNull();
    expect(d!.anonymized_at).not.toBeNull();
    const [t] = await sql`select donor_email_snapshot::text as e, donor_name_snapshot as n, status from transactions where id = ${trx.id}`;
    expect(t!.e).toBe(`deleted+${trx.id}@invalid`);
    expect(t!.n).toBe("Donatur Terhapus");
    expect(t!.status).toBe("paid");
    expect((await sql`select 1 from users where id = ${userId}`).length).toBe(0);
    const [o] = await sql`select access_token_expires_at <= now() as expired, status from transactions where id = ${open.id}`;
    expect(o).toMatchObject({ expired: true, status: "pending" });
    expect(await auditCount(donor!.id, "donor.account_deletion_requested")).toBe(1);

    // Login ulang dengan email yang sama → akun baru, transaksi anonim TIDAK diklaim kembali.
    const userId2 = await insertUser(email);
    const fresh = await ensureDonorAccount({ id: userId2, email, name: "Uji" });
    donorIds.add(fresh!.id);
    expect(fresh!.id).not.toBe(donor!.id);
    expect((await getDonorDashboard(fresh!.id)).summary.paidCount).toBe(0);
  });
});
