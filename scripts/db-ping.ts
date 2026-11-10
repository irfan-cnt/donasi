// Uji koneksi DB: `pnpm db:ping` (butuh DATABASE_URL di .env.local).
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");
  const rows = await neon(url)`select 1 as ok`;
  console.log(rows[0]?.ok === 1 ? "DB OK (select 1)" : "DB respons tidak terduga");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
