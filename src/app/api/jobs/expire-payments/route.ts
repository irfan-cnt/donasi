import { createJobHandler } from "@/lib/jobs/job-route";
import { runExpirePayments } from "@/server/services/jobs/expire-payments";
import {
  continuationDepth,
  publishContinuation,
  runtimeJobDeps,
} from "@/server/services/jobs/runtime-deps";

// QStash schedule tiap 5 menit (scripts/qstash-schedules.ts). Signature wajib (job-route.ts).
// Runtime Node.js default; `export const runtime` tidak kompatibel dengan cacheComponents.
export const maxDuration = 60;

export const POST = createJobHandler(
  "expire-payments",
  { lockTtlMs: 180_000, budgetMs: 45_000 },
  async ({ log, body, deadline }) => {
    const depth = continuationDepth(body);
    const summary = await runExpirePayments(runtimeJobDeps(log), { deadline });
    let continued = false;
    if (summary.hasMore) {
      continued = await publishContinuation("/api/jobs/expire-payments", depth, log).catch(
        (e: unknown) => {
          log.error("expire: publish lanjutan gagal", {
            error: e instanceof Error ? e.name : "unknown",
          });
          return false;
        },
      );
    }
    return { ...summary, depth, continued };
  },
);
