/**
 * P26 — hapus data yang dibuat k6 checkout (tests/load/checkout.k6.js).
 *
 * Hanya menyentuh baris berpenanda run: transaksi dengan `donor_email_snapshot` berbentuk
 * `k6+{RUN_ID}-…@example.test` dan donor tamu (tanpa user) ber-email sama. Transaksi yang sudah
 * punya payment TIDAK dihapus (seharusnya tidak ada: skenario berhenti di createDonation) — skrip
 * berhenti dan melaporkannya.
 *
 * Pakai:
 *   pnpm tsx scripts/load/cleanup-k6.ts --run-id <RUN_ID> --branch <nama branch Neon> [--apply]
 * Tanpa --apply = dry-run (hanya menghitung). `--branch` wajib sama dengan NEON_BRANCH di env
 * (mencegah salah sasaran). DATABASE_URL dibaca dari env / .env.local, tidak pernah dicetak.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const runId = arg("run-id");
  const branch = arg("branch");
  const apply = process.argv.includes("--apply");
  if (!runId || !/^[a-z0-9-]{4,40}$/i.test(runId)) throw new Error("--run-id wajib (huruf/angka/-, 4–40)");
  if (!branch) throw new Error("--branch wajib");
  if (process.env.NEON_BRANCH !== branch) throw new Error("--branch tidak sama dengan NEON_BRANCH env — dibatalkan");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tidak tersedia");
  const sql = neon(process.env.DATABASE_URL);
  const pattern = `k6+${runId}-%@example.test`;

  const [counts] = (await sql`
    select count(*)::int as trx,
      count(*) filter (where exists (select 1 from payments p where p.transaction_id = t.id))::int as "withPayments"
    from transactions t where t.donor_email_snapshot like ${pattern}`) as { trx: number; withPayments: number }[];
  const { trx, withPayments } = counts!;
  const [donorRow] = (await sql`select count(*)::int as donors from donors
    where email like ${pattern} and user_id is null`) as { donors: number }[];
  const donors = donorRow!.donors;
  console.log(JSON.stringify({ runId, branch, transactions: trx, withPayments, guestDonors: donors, apply }));
  if (withPayments > 0) throw new Error("ada transaksi k6 yang punya payment — periksa manual, tidak dihapus");
  if (!apply) return;

  const delTrx = await sql`with nl as (delete from notification_logs where transaction_id in
      (select id from transactions where donor_email_snapshot like ${pattern}))
    delete from transactions where donor_email_snapshot like ${pattern} returning id`;
  const delDonors = await sql`delete from donors d where d.email like ${pattern} and d.user_id is null
    and not exists (select 1 from transactions t where t.donor_id = d.id) returning id`;
  console.log(JSON.stringify({ deletedTransactions: delTrx.length, deletedDonors: delDonors.length }));
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
