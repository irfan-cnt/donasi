import { createJobHandler } from "@/lib/jobs/job-route";
import { runCampaignScheduler } from "@/server/services/jobs/campaign-scheduler";
import { runtimeJobDeps } from "@/server/services/jobs/runtime-deps";

// QStash schedule tiap 15 menit. Signature wajib (job-route.ts).
export const maxDuration = 60;

export const POST = createJobHandler(
  "campaign-scheduler",
  { lockTtlMs: 180_000, budgetMs: 45_000 },
  ({ log }) => runCampaignScheduler({ revalidateTags: runtimeJobDeps(log).revalidateTags }),
);
