// Buat/perbarui schedule QStash job P14 per environment (idempoten).
//   pnpm tsx scripts/qstash-schedules.ts --dry-run   # tampilkan rencana saja (tanpa QSTASH_TOKEN ok)
//   pnpm tsx scripts/qstash-schedules.ts             # terapkan (butuh QSTASH_TOKEN + APP_URL https)
// Opsi: --env-file=.env.production.local (default .env.local; nilainya MENIMPA env shell),
// --prune (hapus schedule tk-{env}-* yang tidak lagi dikenal), --force (izinkan memindah schedule
// yang ada ke host lain), --yes (wajib untuk APP_ENV=production). Idempoten: scheduleId tetap `tk-{APP_ENV}-{job}`; schedule yang
// tujuan & cron-nya sudah sama dilewati, yang berbeda diperbarui lewat scheduleId yang sama.
// Tidak pernah mencetak token.
import { config } from "dotenv";
import { Client } from "@upstash/qstash";

const args = new Set(process.argv.slice(2));
const envFile =
  process.argv.find((a) => a.startsWith("--env-file="))?.split("=")[1] ?? ".env.local";
config({ path: envFile, quiet: true, override: true });

const DRY_RUN = args.has("--dry-run");
const PRUNE = args.has("--prune");
const FORCE = args.has("--force");
const YES = args.has("--yes");
const APP_ENVS = ["development", "preview", "production"] as const;

/** Cron QStash dalam UTC. WIB = UTC+7 tanpa DST: 01:00 WIB = 18:00 UTC. */
const JOBS = [
  { job: "expire-payments", path: "/api/jobs/expire-payments", cron: "*/5 * * * *" },
  { job: "cancel-stale", path: "/api/jobs/cancel-stale", cron: "7 * * * *" },
  { job: "reconcile", path: "/api/jobs/reconcile", cron: "0 18 * * *" },
  { job: "campaign-scheduler", path: "/api/jobs/campaign-scheduler", cron: "*/15 * * * *" },
] as const;

function planSchedules(appUrl: string, appEnv: string) {
  const base = appUrl.replace(/\/+$/, "");
  return JOBS.map((j) => ({
    scheduleId: `tk-${appEnv}-${j.job}`,
    destination: `${base}${j.path}`,
    cron: j.cron,
  }));
}

async function main() {
  const appEnv = process.env.APP_ENV || "development";
  if (!(APP_ENVS as readonly string[]).includes(appEnv)) {
    throw new Error(`APP_ENV tidak valid (harus ${APP_ENVS.join("/")})`);
  }
  if (appEnv === "production" && !DRY_RUN && !YES) {
    throw new Error("APP_ENV=production: tambahkan --yes untuk menerapkan schedule");
  }
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL belum diisi");
  const url = new URL(appUrl);
  if (!DRY_RUN && url.protocol !== "https:") {
    throw new Error("APP_URL harus https (QStash tidak dapat menjangkau localhost/http)");
  }
  const plan = planSchedules(appUrl, appEnv);
  console.log(`Environment: ${appEnv} · APP_URL: ${url.origin}${DRY_RUN ? " · DRY RUN" : ""}`);

  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    if (!DRY_RUN) throw new Error("QSTASH_TOKEN belum diisi");
    for (const p of plan) console.log(`  [plan] ${p.scheduleId}  ${p.cron}  → ${p.destination}`);
    console.log("QSTASH_TOKEN kosong: status schedule yang ada tidak dicek.");
    return;
  }

  const client = new Client({ token });
  const existing = new Map((await client.schedules.list()).map((s) => [s.scheduleId, s]));
  for (const p of plan) {
    const cur = existing.get(p.scheduleId);
    const same = cur && cur.destination === p.destination && cur.cron === p.cron;
    const action = same ? "ok" : cur ? "update" : "create";
    if (cur && !same && new URL(cur.destination).host !== url.host && !FORCE) {
      throw new Error(
        `${p.scheduleId} mengarah ke host lain (${new URL(cur.destination).host}); pakai --force bila disengaja`,
      );
    }
    console.log(`  [${action}] ${p.scheduleId}  ${p.cron}  → ${p.destination}`);
    if (same || DRY_RUN) continue;
    await client.schedules.create({
      scheduleId: p.scheduleId,
      destination: p.destination,
      cron: p.cron,
      body: "{}",
      headers: { "Content-Type": "application/json" },
      retries: 3,
    });
  }

  const known = new Set(plan.map((p) => p.scheduleId));
  for (const id of existing.keys()) {
    if (!id.startsWith(`tk-${appEnv}-`) || known.has(id)) continue;
    console.log(`  [${PRUNE ? "delete" : "unknown"}] ${id}`);
    if (PRUNE && !DRY_RUN) await client.schedules.delete(id);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
