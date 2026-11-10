// Helper KHUSUS TEST: seed user + sesi Auth.js langsung ke DB (tanpa Google nyata).
import { randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

function sql() {
  // Pengaman: hanya boleh menulis ke branch Neon `dev`.
  if (process.env.NEON_BRANCH !== "dev") {
    throw new Error("E2E seeding hanya diizinkan bila NEON_BRANCH=dev");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tidak tersedia untuk e2e");
  return neon(url);
}

export const SESSION_COOKIE = "authjs.session-token";

export interface SeededDonorSession {
  userId: string;
  email: string;
  name: string;
  sessionToken: string;
}

export async function seedDonorSession(): Promise<SeededDonorSession> {
  const db = sql();
  const userId = randomUUID();
  const email = `e2e+${userId}@example.test`;
  const name = "Donatur E2E";
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await db`insert into users (id, name, email, email_verified) values (${userId}, ${name}, ${email}, now())`;
  await db`insert into sessions (session_token, user_id, expires) values (${sessionToken}, ${userId}, ${expires})`;
  return { userId, email, name, sessionToken };
}

export async function sessionExists(sessionToken: string): Promise<boolean> {
  const rows = await sql()`select 1 from sessions where session_token = ${sessionToken}`;
  return rows.length > 0;
}

export async function donorExistsForUser(userId: string): Promise<boolean> {
  const rows = await sql()`select 1 from donors where user_id = ${userId}`;
  return rows.length > 0;
}

/** Hapus semua baris hasil seed (donor dulu, lalu user → sessions/accounts ikut cascade). */
export async function cleanupDonorSession(seed: SeededDonorSession): Promise<void> {
  const db = sql();
  await db`delete from donors where user_id = ${seed.userId} or email = ${seed.email}`;
  await db`delete from users where id = ${seed.userId}`;
}
