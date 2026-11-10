import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { buildAuditRow } from "@/lib/audit/audit-row";
import { getDb, getTxDb } from "@/lib/db";
import { auditLogs, donors, transactions, users } from "@/lib/db/schema";

export type DonorRow = typeof donors.$inferSelect;

export async function findDonorByUserId(userId: string): Promise<DonorRow | undefined> {
  const rows = await getDb().select().from(donors).where(eq(donors.userId, userId)).limit(1);
  return rows[0];
}

export interface ClaimResult {
  /** Baris donor tamu (email sama, belum punya user) ditautkan ke user ini. */
  linkedGuestDonor: boolean;
  /** Jumlah transaksi tamu milik donor tamu lain yang dipindah ke donor akun. */
  movedTransactions: number;
}

/**
 * Buat donor untuk user, atau tautkan donor tamu ber-email sama, lalu klaim transaksi tamu
 * (F-11, AC-11.x). Satu transaksi DB; idempoten — login berikutnya tidak mengubah apa pun dan
 * tidak menulis audit.
 *
 * Skema: `donors.email` UNIQUE, sehingga donor tamu dengan email yang sama adalah SATU baris →
 * baris itu ditautkan (bukan digabung) dan seluruh transaksinya ikut. Transaksi yang
 * `donor_email_snapshot`-nya sama (citext = case-insensitive) tetapi tercatat pada donor tamu
 * LAIN (tanpa user, belum dianonimkan) dipindah ke donor akun; baris donor tamu lain itu
 * dibiarkan (mungkin masih punya transaksi ber-email lain). Donor milik user lain atau yang
 * sudah dianonimkan tidak pernah disentuh.
 */
export async function upsertDonorForUser(input: {
  userId: string;
  email: string;
  name: string;
}): Promise<{ donor: DonorRow | undefined; claim: ClaimResult }> {
  return getTxDb().transaction(async (tx) => {
    await tx
      .insert(donors)
      .values({ userId: input.userId, email: input.email, name: input.name })
      .onConflictDoNothing();
    const linked = await tx
      .update(donors)
      .set({
        userId: input.userId,
        // Field tamu dideklarasikan sendiri (siapa pun bisa checkout dengan email ini) → reset
        // agar nama/WA/opt-in yang ditanam pihak lain tidak dipakai akun (review keamanan P18 M1).
        name: input.name,
        phoneE164: null,
        whatsappOptIn: false,
        defaultAnonymous: false,
        updatedAt: sql`now()`,
      })
      .where(and(eq(donors.email, input.email), isNull(donors.userId), isNull(donors.anonymizedAt)))
      .returning({ id: donors.id });
    const [donor] = await tx.select().from(donors).where(eq(donors.userId, input.userId)).limit(1);
    const claim: ClaimResult = { linkedGuestDonor: linked.length > 0, movedTransactions: 0 };
    if (!donor) return { donor, claim };

    const guestDonorIds = tx
      .select({ id: donors.id })
      .from(donors)
      .where(and(isNull(donors.userId), isNull(donors.anonymizedAt)));
    const moved = await tx
      .update(transactions)
      .set({ donorId: donor.id, updatedAt: sql`now()` })
      .where(
        and(
          eq(transactions.donorEmailSnapshot, input.email),
          ne(transactions.donorId, donor.id),
          inArray(transactions.donorId, guestDonorIds),
        ),
      )
      .returning({ id: transactions.id });
    claim.movedTransactions = moved.length;

    if (claim.linkedGuestDonor || claim.movedTransactions > 0) {
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(transactions)
        .where(eq(transactions.donorId, donor.id));
      await tx.insert(auditLogs).values(
        buildAuditRow({
          actor: { type: "donor", id: donor.id },
          action: "donor.guest_transactions_claimed",
          entityType: "donor",
          entityId: donor.id,
          metadata: {
            linkedGuestDonor: claim.linkedGuestDonor,
            movedTransactions: claim.movedTransactions,
            transactionCount: count?.n ?? 0,
          },
        }),
      );
    }
    return { donor, claim };
  });
}

export async function updateDonorProfile(
  donorId: string,
  values: { name: string; phoneE164: string | null; whatsappOptIn: boolean; defaultAnonymous: boolean },
): Promise<void> {
  await getDb()
    .update(donors)
    .set({ ...values, updatedAt: sql`now()` })
    .where(and(eq(donors.id, donorId), isNull(donors.anonymizedAt)));
}

export const DELETED_DONOR_NAME = "Donatur Terhapus";

/**
 * Anonimisasi akun (database-security.md §6) dalam satu transaksi DB:
 * donor → nama "Donatur Terhapus", email `deleted+{uuid}@invalid`, WA NULL, preferensi off,
 * `anonymized_at`, `user_id` NULL; snapshot PII transaksi: email → `deleted+{transaction id}@invalid`, WA → NULL, nama →
 * "Donatur Terhapus" (nominal, status, kode & kuitansi tetap untuk audit keuangan); baris
 * `users` dihapus (sessions/accounts ikut cascade). Permintaan + hasil dicatat di audit_logs.
 */
export async function anonymizeDonorAccount(args: {
  donorId: string;
  userId: string;
  ip: string | null;
  ua: string | null;
}): Promise<boolean> {
  return getTxDb().transaction(async (tx) => {
    const updated = await tx
      .update(donors)
      .set({
        name: DELETED_DONOR_NAME,
        email: sql`'deleted+' || ${donors.id}::text || '@invalid'`,
        phoneE164: null,
        whatsappOptIn: false,
        defaultAnonymous: false,
        anonymizedAt: sql`now()`,
        userId: null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(donors.id, args.donorId), eq(donors.userId, args.userId), isNull(donors.anonymizedAt)))
      .returning({ id: donors.id });
    if (updated.length !== 1) return false;
    const trx = await tx
      .update(transactions)
      .set({
        donorNameSnapshot: DELETED_DONOR_NAME,
        // Placeholder tak terbalikkan (bukan hash email — hash tanpa salt bisa ditebak).
        donorEmailSnapshot: sql`'deleted+' || ${transactions.id}::text || '@invalid'`,
        donorPhoneSnapshot: null,
        whatsappOptIn: false,
        updatedAt: sql`now()`,
      })
      .where(eq(transactions.donorId, args.donorId))
      .returning({ id: transactions.id });
    // Cabut access token transaksi yang masih terbuka (payment tetap hidup; webhook tetap bisa
    // menandai paid). Kolom NOT NULL → hash acak + kedaluwarsa sekarang.
    await tx
      .update(transactions)
      .set({ accessTokenHash: randomBytes(32), accessTokenExpiresAt: sql`now()` })
      .where(and(eq(transactions.donorId, args.donorId), inArray(transactions.status, ["created", "pending"])));
    await tx.delete(users).where(eq(users.id, args.userId));
    const base = { actor: { type: "donor", id: args.donorId } as const, entityType: "donor", entityId: args.donorId, ip: args.ip, ua: args.ua };
    await tx.insert(auditLogs).values([
      buildAuditRow({ ...base, action: "donor.account_deletion_requested" }),
      buildAuditRow({ ...base, action: "donor.anonymized", metadata: { transactionsAnonymized: trx.length } }),
    ]);
    return true;
  });
}
