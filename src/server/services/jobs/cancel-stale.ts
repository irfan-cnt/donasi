import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scopeClause, type JobScope } from "./job-deps";

// BR-15: transaksi `created` tanpa payment aktif (created/pending/paid) > 24 jam → `cancelled`.
// Attempt yang gagal (payment `failed`) tidak dihitung aktif. UPDATE + audit dalam satu statement;
// guard `t.status = 'created'` membuat job idempoten. Tidak menyentuh nominal/total campaign.

export const STALE_HOURS = 24;
export const CANCEL_BATCH_SIZE = 500;

export async function cancelStaleBatch(limit: number, scope?: JobScope): Promise<number> {
  const r = await getDb().execute<{ entity_id: string }>(sql`
    WITH cand AS (
      SELECT t.id FROM transactions t
      WHERE t.status = 'created'
        AND t.created_at < now() - make_interval(hours => ${STALE_HOURS})
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.transaction_id = t.id
          AND p.status IN ('created', 'pending', 'paid'))
        ${scopeClause(sql`t.campaign_id`, scope)}
      ORDER BY t.created_at
      LIMIT ${limit}
      FOR UPDATE OF t SKIP LOCKED
    ), upd AS (
      UPDATE transactions t SET status = 'cancelled', updated_at = now()
      FROM cand WHERE t.id = cand.id AND t.status = 'created'
      RETURNING t.id
    )
    INSERT INTO audit_logs (actor_type, action, entity_type, entity_id, metadata)
    SELECT 'system', 'transaction.cancelled_stale', 'transaction', upd.id::text,
      jsonb_build_object('from', 'created', 'to', 'cancelled', 'rule', 'BR-15')
    FROM upd
    RETURNING entity_id`);
  return r.rows.length;
}

export async function runCancelStale(opts: {
  deadline: number;
  now?: () => number;
  batchSize?: number;
  scope?: JobScope;
}): Promise<{ [k: string]: unknown; cancelled: number; hasMore: boolean }> {
  const now = opts.now ?? Date.now;
  const limit = opts.batchSize ?? CANCEL_BATCH_SIZE;
  let cancelled = 0;
  for (;;) {
    if (now() >= opts.deadline) return { cancelled, hasMore: true };
    const n = await cancelStaleBatch(limit, opts.scope);
    cancelled += n;
    if (n < limit) return { cancelled, hasMore: false };
  }
}
