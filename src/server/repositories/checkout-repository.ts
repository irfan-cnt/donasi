import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  campaignAmountOptions,
  campaigns,
  donors,
  platformSettings,
  transactions,
} from "@/lib/db/schema";

export interface CheckoutCampaignRow {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "paused" | "completed" | "archived";
  amountType: "open" | "fixed";
  minAmount: bigint;
  maxAmount: bigint | null;
  startAt: Date | null;
  endAt: Date | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
}

export interface AmountOptionRow {
  id: string;
  kind: "suggested" | "package";
  label: string | null;
  amount: bigint;
  description: string | null;
}

export async function findCheckoutCampaign(slug: string): Promise<CheckoutCampaignRow | undefined> {
  const [row] = await getDb()
    .select({
      id: campaigns.id,
      slug: campaigns.slug,
      title: campaigns.title,
      status: campaigns.status,
      amountType: campaigns.amountType,
      minAmount: campaigns.minAmount,
      maxAmount: campaigns.maxAmount,
      startAt: campaigns.startAt,
      endAt: campaigns.endAt,
      featuredImageUrl: campaigns.featuredImageUrl,
      featuredImageAlt: campaigns.featuredImageAlt,
    })
    .from(campaigns)
    .where(eq(campaigns.slug, slug))
    .limit(1);
  return row;
}

/** Opsi aktif sesuai sort_order; `kind` = package (fixed) atau suggested (open). */
export async function listActiveAmountOptions(
  campaignId: string,
  kind: "suggested" | "package",
): Promise<AmountOptionRow[]> {
  return getDb()
    .select({
      id: campaignAmountOptions.id,
      kind: campaignAmountOptions.kind,
      label: campaignAmountOptions.label,
      amount: campaignAmountOptions.amount,
      description: campaignAmountOptions.description,
    })
    .from(campaignAmountOptions)
    .where(
      and(
        eq(campaignAmountOptions.campaignId, campaignId),
        eq(campaignAmountOptions.kind, kind),
        eq(campaignAmountOptions.isActive, true),
      ),
    )
    .orderBy(asc(campaignAmountOptions.sortOrder), asc(campaignAmountOptions.amount));
}

/** Paket aktif milik campaign (BR-07); undefined bila nonaktif / milik campaign lain. */
export async function findActivePackage(
  campaignId: string,
  optionId: string,
): Promise<AmountOptionRow | undefined> {
  const [row] = await getDb()
    .select({
      id: campaignAmountOptions.id,
      kind: campaignAmountOptions.kind,
      label: campaignAmountOptions.label,
      amount: campaignAmountOptions.amount,
      description: campaignAmountOptions.description,
    })
    .from(campaignAmountOptions)
    .where(
      and(
        eq(campaignAmountOptions.id, optionId),
        eq(campaignAmountOptions.campaignId, campaignId),
        eq(campaignAmountOptions.kind, "package"),
        eq(campaignAmountOptions.isActive, true),
      ),
    )
    .limit(1);
  return row;
}

export async function findPlatformSetting(key: string): Promise<unknown> {
  const [row] = await getDb()
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return row?.value;
}

export async function findDonorById(id: string) {
  const [row] = await getDb().select().from(donors).where(eq(donors.id, id)).limit(1);
  return row;
}

/**
 * Donor tamu berdasarkan email ternormalisasi. Donor yang sudah ada TIDAK diubah (nama/WA
 * per transaksi tersimpan di snapshot; profil donor terdaftar tidak boleh ditimpa tamu).
 */
export async function upsertGuestDonor(input: {
  email: string;
  name: string;
  phoneE164: string | null;
  whatsappOptIn: boolean;
}): Promise<string> {
  const db = getDb();
  const inserted = await db
    .insert(donors)
    .values({
      email: input.email,
      name: input.name,
      phoneE164: input.phoneE164,
      whatsappOptIn: input.whatsappOptIn,
    })
    .onConflictDoNothing({ target: donors.email })
    .returning({ id: donors.id });
  if (inserted[0]) return inserted[0].id;
  const [existing] = await db
    .select({ id: donors.id })
    .from(donors)
    .where(eq(donors.email, input.email))
    .limit(1);
  if (!existing) throw new Error("donor tidak ditemukan setelah upsert");
  return existing.id;
}

export type NewTransaction = typeof transactions.$inferInsert;

export async function insertTransaction(values: NewTransaction): Promise<{ id: string; code: string }> {
  const [row] = await getDb()
    .insert(transactions)
    .values(values)
    .returning({ id: transactions.id, code: transactions.code });
  return row!;
}

/** Transaksi hanya bila kode + hash token cocok dan token belum kedaluwarsa (security.md §2). */
export async function findTransactionByAccessToken(code: string, tokenHash: Buffer, now: Date) {
  const [row] = await getDb()
    .select({
      id: transactions.id,
      code: transactions.code,
      amount: transactions.amount,
      status: transactions.status,
      campaignTitle: transactions.campaignTitleSnapshot,
      donorName: transactions.donorNameSnapshot,
      isAnonymous: transactions.isAnonymous,
      createdAt: transactions.createdAt,
      campaignSlug: campaigns.slug,
    })
    .from(transactions)
    .innerJoin(campaigns, eq(transactions.campaignId, campaigns.id))
    .where(
      and(
        eq(transactions.code, code),
        eq(transactions.accessTokenHash, tokenHash),
        gt(transactions.accessTokenExpiresAt, now),
      ),
    )
    .limit(1);
  return row;
}
