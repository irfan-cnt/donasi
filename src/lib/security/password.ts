// Hash password admin: argon2id (m=19456, t=2, p=1) — docs/03-technical/security.md §2.
// Sengaja TANPA `server-only` agar bisa dipakai scripts/admin-create.ts (tidak membaca secret).
import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  // Default @node-rs/argon2 = Argon2id.
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hash dummy untuk menyamakan waktu respons saat email tidak dikenal (anti-enumerasi). */
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("dummy-password-for-timing-equalization");
  return dummyHash;
}
