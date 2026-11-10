import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { CAMPAIGNS_TAG, campaignTag } from "@/server/queries/public-campaigns";
import { scopeClause, type JobScope } from "./job-deps";

// Campaign `published` yang end_at-nya lewat → `completed` (tiap 15 menit) + audit + revalidateTag.
// Guard status membuat job idempoten. Total campaign tidak disentuh.

export async function runCampaignScheduler(opts: {
  revalidateTags: (tags: string[]) => void;
  scope?: JobScope;
}): Promise<{ [k: string]: unknown; completed: number }> {
  const r = await getDb().execute<{ id: string; slug: string }>(sql`
    WITH upd AS (
      UPDATE campaigns c SET status = 'completed', updated_at = now()
      WHERE c.status = 'published' AND c.end_at IS NOT NULL AND c.end_at < now()
        ${scopeClause(sql`c.id`, opts.scope)}
      RETURNING c.id, c.slug
    ), aud AS (
      INSERT INTO audit_logs (actor_type, action, entity_type, entity_id, metadata)
      SELECT 'system', 'campaign.auto_completed', 'campaign', upd.id::text,
        jsonb_build_object('from', 'published', 'to', 'completed', 'reason', 'end_at_passed')
      FROM upd
    )
    SELECT id, slug FROM upd`);
  if (r.rows.length > 0) {
    opts.revalidateTags([CAMPAIGNS_TAG, ...r.rows.map((c) => campaignTag(c.slug))]);
  }
  return { completed: r.rows.length };
}
