import { createJobHandler } from "@/lib/jobs/job-route";
import { getExportStore } from "@/lib/storage/export-storage";
import { cleanupExportFiles } from "@/server/services/admin-export-service";
import { runCancelStale } from "@/server/services/jobs/cancel-stale";

// QStash schedule tiap jam (BR-15). Signature wajib (job-route.ts).
// P22: sekaligus menghapus berkas ekspor CSV (PII) yang melewati retensi 2 jam — tidak
// bergantung pada ekspor berikutnya. Gagal bersih-bersih tidak menggagalkan cancel-stale.
export const maxDuration = 60;

export const POST = createJobHandler(
  "cancel-stale",
  { lockTtlMs: 180_000, budgetMs: 45_000 },
  async ({ deadline, log }) => ({
    ...(await runCancelStale({ deadline })),
    ...(await cleanupExportFiles(getExportStore(), log)),
  }),
);
