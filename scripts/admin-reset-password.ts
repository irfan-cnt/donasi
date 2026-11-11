// Reset akses admin yang lupa password / kehilangan autentikator:
//   pnpm admin:reset-password --email <email>
// Password acak 20 karakter ditampilkan SEKALI di terminal; tidak pernah ditulis ke file/log.
// Efek: password baru (wajib ganti saat login), TOTP dihapus (pasang ulang), lockout dibuka,
// semua sesi admin tersebut dihapus, tercatat di audit_logs.
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { z } from "zod";
import { buildAuditRow } from "@/lib/audit/audit-row";
import * as s from "@/lib/db/schema";
import { hashPassword } from "@/lib/security/password";
import { generatePassword } from "./seed/cli";

config({ path: ".env.local", quiet: true });

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("email tidak valid"));

function parseEmail(argv: readonly string[]): string {
  let raw: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--email") raw = argv[++i];
    else if (arg.startsWith("--email=")) raw = arg.slice("--email=".length);
    else throw new Error(`Argumen tidak dikenal: ${arg}`);
  }
  if (!raw) throw new Error("Pakai: pnpm admin:reset-password --email <email>");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  return parsed.data;
}

async function main() {
  const email = parseEmail(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");

  const password = generatePassword(20);
  const passwordHash = await hashPassword(password); // argon2id, security.md §2

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: s });
  try {
    await db.transaction(async (tx) => {
      const [admin] = await tx
        .update(s.adminUsers)
        .set({
          passwordHash,
          mustChangePassword: true,
          totpSecretEnc: null,
          totpEnabled: false,
          totpLastStep: null,
          failedLoginCount: 0,
          lockedUntil: null,
          updatedAt: sql`now()`,
        })
        .where(eq(s.adminUsers.email, email))
        .returning({ id: s.adminUsers.id });
      if (!admin) throw new Error(`Admin dengan email ${email} tidak ditemukan`);
      await tx.delete(s.adminSessions).where(eq(s.adminSessions.adminUserId, admin.id));
      await tx.insert(s.auditLogs).values(
        buildAuditRow({
          actor: { type: "system" },
          action: "admin.password_reset",
          entityType: "admin_user",
          entityId: admin.id,
          metadata: { via: "cli", totpCleared: true, sessionsRevoked: true },
        }),
      );
    });
  } finally {
    await pool.end();
  }

  process.stdout.write(
    [
      `Akses admin direset: ${email}`,
      "Password sementara (hanya ditampilkan sekali, simpan di password manager):",
      "",
      `  ${password}`,
      "",
      "Wajib ganti password & pasang ulang autentikator (TOTP) saat login.",
      "",
    ].join("\n"),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
