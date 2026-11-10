import "server-only";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaignNews, campaigns, donors, sessions, transactions } from "@/lib/db/schema";

// Cek keberadaan untuk src/proxy.ts: dengan cacheComponents, notFound() di halaman terjadi setelah
// shell mulai di-stream (status 200 + noindex). Agar draft/archived/slug salah benar-benar 404,
// proxy memeriksa lebih dulu (docs Next: streaming.md "To return a request-time 404, use Proxy").
// Memo in-process 60 detik (selaras ISR 60 s) agar tidak query DB setiap request.

const TTL_MS = 60_000;
const MAX_ENTRIES = 1000;
const memo = new Map<string, { value: boolean; exp: number }>();

async function memoized(key: string, load: () => Promise<boolean>): Promise<boolean> {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && hit.exp > now) return hit.value;
  const value = await load();
  if (memo.size >= MAX_ENTRIES) memo.clear();
  memo.set(key, { value, exp: now + TTL_MS });
  return value;
}

const PUBLIC = ["published", "paused", "completed"] as const;

export function publicCampaignExists(slug: string): Promise<boolean> {
  return memoized(`c:${slug}`, async () => {
    const rows = await getDb()
      .select({ one: sql<number>`1` })
      .from(campaigns)
      .where(and(eq(campaigns.slug, slug), inArray(campaigns.status, [...PUBLIC])))
      .limit(1);
    return rows.length > 0;
  });
}

export function publicNewsExists(slug: string, newsSlug: string): Promise<boolean> {
  return memoized(`n:${slug}/${newsSlug}`, async () => {
    const rows = await getDb()
      .select({ one: sql<number>`1` })
      .from(campaignNews)
      .innerJoin(campaigns, eq(campaignNews.campaignId, campaigns.id))
      .where(
        and(
          eq(campaigns.slug, slug),
          inArray(campaigns.status, [...PUBLIC]),
          eq(campaignNews.slug, newsSlug),
          eq(campaignNews.status, "published"),
          isNull(campaignNews.deletedAt),
        ),
      )
      .limit(1);
    return rows.length > 0;
  });
}

/** Pratinjau: tanpa memo (status draft bisa berubah kapan saja; jarang diakses). */
export async function previewCampaignExists(slug: string, campaignId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ one: sql<number>`1` })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.slug, slug),
        eq(campaigns.id, campaignId),
        sql`${campaigns.status} <> 'archived'`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Halaman pembayaran: kode + hash access token cocok, belum kedaluwarsa, dan campaign sesuai
 * slug. Tanpa memo (token per transaksi). Hash dihitung pemanggil — token mentah tidak disimpan.
 */
export async function transactionAccessExists(
  slug: string,
  code: string,
  tokenHash: Buffer,
): Promise<boolean> {
  const rows = await getDb()
    .select({ one: sql<number>`1` })
    .from(transactions)
    .innerJoin(campaigns, eq(transactions.campaignId, campaigns.id))
    .where(
      and(
        eq(transactions.code, code),
        eq(transactions.accessTokenHash, tokenHash),
        gt(transactions.accessTokenExpiresAt, new Date()),
        eq(campaigns.slug, slug),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Halaman /transaksi/[code]/*: kode + hash access token cocok dan belum kedaluwarsa. */
export async function transactionTokenValid(code: string, tokenHash: Buffer): Promise<boolean> {
  const rows = await getDb()
    .select({ one: sql<number>`1` })
    .from(transactions)
    .where(
      and(
        eq(transactions.code, code),
        eq(transactions.accessTokenHash, tokenHash),
        gt(transactions.accessTokenExpiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * /akun/donasi/[code]: transaksi milik donor dari sesi DB (cookie) ada. Tidak dimemo (data
 * per-donor). Halaman tetap memeriksa ulang lewat requireDonor + filter donorId (AC-13.1).
 */
export async function donorTransactionAccess(
  sessionToken: string,
  code: string,
): Promise<"owner" | "not_found" | "no_session"> {
  const rows = await getDb()
    .select({ owned: sql<boolean>`${transactions.id} is not null` })
    .from(sessions)
    .leftJoin(donors, eq(donors.userId, sessions.userId))
    .leftJoin(transactions, and(eq(transactions.donorId, donors.id), eq(transactions.code, code)))
    .where(and(eq(sessions.sessionToken, sessionToken), gt(sessions.expires, new Date())))
    .limit(1);
  if (!rows[0]) return "no_session";
  return rows[0].owned ? "owner" : "not_found";
}
