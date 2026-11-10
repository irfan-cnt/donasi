import { createJobHandler } from "@/lib/jobs/job-route";
import { runReconcile } from "@/server/services/jobs/reconcile";
import { jakartaDate, runtimeJobDeps } from "@/server/services/jobs/runtime-deps";

// QStash schedule 01:00 WIB (cron 18:00 UTC). Signature wajib (job-route.ts).
export const maxDuration = 60;

export const POST = createJobHandler(
  "reconcile",
  { lockTtlMs: 600_000, budgetMs: 50_000 },
  ({ log, deadline }) => runReconcile(runtimeJobDeps(log), { deadline, date: jakartaDate() }),
);
