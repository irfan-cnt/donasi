import { createJobHandler } from "@/lib/jobs/job-route";
import { getExportStore } from "@/lib/storage/export-storage";
import { runExportJob } from "@/server/services/admin-export-service";

// Ekspor CSV besar (> 10.000 baris, P22). Dipublish oleh POST /api/admin/exports; signature
// QStash wajib (job-route.ts). Lock per exportId (pesan kembar diserialkan).
export const maxDuration = 300;

export const POST = createJobHandler(
  "export",
  {
    lockTtlMs: 330_000,
    budgetMs: 280_000,
    lockName: (body) =>
      `job:export:${typeof body === "object" && body && "exportId" in body ? String(body.exportId).slice(0, 36) : "none"}`,
  },
  ({ log, body }) => runExportJob(body, { store: getExportStore(), log }),
);
