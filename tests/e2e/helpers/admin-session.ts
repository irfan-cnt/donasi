// Helper KHUSUS TEST: seed admin + sesi admin langsung ke DB. Hanya baris @example.test yang
// dibuat di sini yang disentuh/dihapus — admin nyata di branch dev tidak pernah diubah.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { hashPassword } from "../../../src/lib/security/password";

config({ path: ".env.local", quiet: true });

function sql() {
  if (process.env.NEON_BRANCH !== "dev") {
    throw new Error("E2E seeding hanya diizinkan bila NEON_BRANCH=dev");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak tersedia untuk e2e");
  return neon(url);
}

/** Nama cookie admin saat APP_ENV=development (http localhost). */
export const ADMIN_COOKIE = "tk_admin";
export const ADMIN_PASSWORD = "Password-Uji-E2E-123";

export interface SeededAdmin {
  id: string;
  email: string;
}

export async function seedAdmin(opts: {
  role: "owner" | "admin" | "finance" | "editor";
  mustChangePassword?: boolean;
}): Promise<SeededAdmin> {
  const db = sql();
  const id = randomUUID();
  const email = `e2e-admin+${id}@example.test`;
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await db`insert into admin_users (id, email, name, password_hash, must_change_password)
    values (${id}, ${email}, ${"Admin E2E"}, ${passwordHash}, ${opts.mustChangePassword ?? false})`;
  const roles = await db`select id from roles where code = ${opts.role}`;
  if (!roles[0]) throw new Error(`Role ${opts.role} belum di-seed (pnpm db:seed)`);
  await db`insert into admin_user_roles (admin_user_id, role_id) values (${id}, ${roles[0].id})`;
  return { id, email };
}

/** Buat sesi admin; `idleMinutes` menggeser last_seen_at ke masa lalu. */
export async function seedAdminSession(adminId: string, idleMinutes = 0): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest();
  const now = Date.now();
  const lastSeen = new Date(now - idleMinutes * 60_000);
  const expires = new Date(now + 8 * 60 * 60_000);
  await sql()`insert into admin_sessions (id, admin_user_id, token_hash, created_at, last_seen_at, expires_at)
    values (${randomUUID()}, ${adminId}, ${"\\x" + hash.toString("hex")}, ${lastSeen}, ${lastSeen}, ${expires})`;
  return token;
}

export async function getAdminRow(id: string) {
  const rows = await sql()`select failed_login_count, locked_until, must_change_password,
    totp_enabled, totp_secret_enc from admin_users where id = ${id}`;
  return rows[0] as {
    failed_login_count: number;
    locked_until: Date | null;
    must_change_password: boolean;
    totp_enabled: boolean;
    totp_secret_enc: string | null;
  };
}

export async function auditActions(adminId: string): Promise<string[]> {
  const rows = await sql()`select action from audit_logs where actor_id = ${adminId} order by id`;
  return rows.map((r) => r.action as string);
}

export async function cleanupAdmin(admin: SeededAdmin): Promise<void> {
  const db = sql();
  if (!admin.email.endsWith("@example.test")) throw new Error("Menolak menghapus admin non-uji");
  // audit_logs append-only di produksi (app_rw tanpa DELETE); di dev bersihkan bila diizinkan.
  await db`delete from audit_logs where actor_id = ${admin.id} or entity_id = ${admin.id}`.catch(
    () => undefined,
  );
  await db`delete from admin_users where id = ${admin.id} and email = ${admin.email}`;
}
