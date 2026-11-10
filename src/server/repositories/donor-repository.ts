import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { donors } from "@/lib/db/schema";

export type DonorRow = typeof donors.$inferSelect;

export async function findDonorByUserId(userId: string): Promise<DonorRow | undefined> {
  const rows = await getDb().select().from(donors).where(eq(donors.userId, userId)).limit(1);
  return rows[0];
}

/**
 * Buat donor untuk user, atau tautkan donor ber-email sama yang belum punya user.
 * Idempoten. Tidak menyentuh transaksi (klaim transaksi tamu = P18).
 */
export async function upsertDonorForUser(input: {
  userId: string;
  email: string;
  name: string;
}): Promise<DonorRow | undefined> {
  const db = getDb();
  await db
    .insert(donors)
    .values({ userId: input.userId, email: input.email, name: input.name })
    .onConflictDoNothing();
  await db
    .update(donors)
    .set({ userId: input.userId, updatedAt: new Date() })
    .where(and(eq(donors.email, input.email), isNull(donors.userId)));
  return findDonorByUserId(input.userId);
}
