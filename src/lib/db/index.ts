import "server-only";
import { neon, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleHttp, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { getEnv } from "@/lib/env";

let httpDb: NeonHttpDatabase | undefined;
let poolDb: NeonDatabase | undefined;

/** Drizzle via HTTP (query tunggal, cepat di serverless). */
export function getDb(): NeonHttpDatabase {
  httpDb ??= drizzleHttp(neon(getEnv().DATABASE_URL));
  return httpDb;
}

/** Drizzle via WebSocket Pool — wajib untuk `db.transaction()` (mis. BR-19). */
export function getTxDb(): NeonDatabase {
  poolDb ??= drizzleServerless(new Pool({ connectionString: getEnv().DATABASE_URL }));
  return poolDb;
}

/** Uji koneksi: `select 1`. */
export async function pingDb(): Promise<boolean> {
  const result = await getDb().execute(sql`select 1 as ok`);
  return result.rows[0]?.ok === 1;
}
