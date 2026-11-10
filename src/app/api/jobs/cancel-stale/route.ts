import { createJobHandler } from "@/lib/jobs/job-route";
import { runCancelStale } from "@/server/services/jobs/cancel-stale";

// QStash schedule tiap jam (BR-15). Signature wajib (job-route.ts).
export const maxDuration = 60;

export const POST = createJobHandler(
  "cancel-stale",
  { lockTtlMs: 180_000, budgetMs: 45_000 },
  ({ deadline }) => runCancelStale({ deadline }),
);
