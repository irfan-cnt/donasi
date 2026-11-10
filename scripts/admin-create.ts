// Buat akun admin: `pnpm admin:create --email <email> --name <nama> --role owner`.
// Password acak 20 karakter ditampilkan SEKALI di terminal; tidak pernah ditulis ke file/log.
import { config } from "dotenv";
import { hash } from "@node-rs/argon2";
import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as s from "@/lib/db/schema";
import { generatePassword, parseAdminArgs } from "./seed/cli";

config({ path: ".env.local", quiet: true });

async function main() {
  const args = parseAdminArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");

  const password = generatePassword(20);
  // argon2id (default @node-rs/argon2), parameter sesuai docs/03-technical/security.md.
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: s });
  try {
    await db.transaction(async (tx) => {
      const [role] = await tx
        .select({ id: s.roles.id })
        .from(s.roles)
        .where(eq(s.roles.code, args.role));
      if (!role) throw new Error(`Role "${args.role}" belum ada — jalankan \`pnpm db:seed\` dulu`);
      const [admin] = await tx
        .insert(s.adminUsers)
        .values({ email: args.email, name: args.name, passwordHash, mustChangePassword: true })
        .onConflictDoNothing({ target: s.adminUsers.email })
        .returning({ id: s.adminUsers.id });
      if (!admin) throw new Error(`Admin dengan email ${args.email} sudah ada`);
      await tx.insert(s.adminUserRoles).values({ adminUserId: admin.id, roleId: role.id });
      await tx.insert(s.auditLogs).values({
        actorType: "system",
        action: "admin.create",
        entityType: "admin_user",
        entityId: admin.id,
        after: { email: args.email, name: args.name, role: args.role },
        metadata: { via: "cli" },
      });
    });
  } finally {
    await pool.end();
  }

  process.stdout.write(
    [
      `Admin dibuat: ${args.email} (role: ${args.role})`,
      "Password sementara (hanya ditampilkan sekali, simpan di password manager):",
      "",
      `  ${password}`,
      "",
      "Wajib ganti password & aktifkan TOTP saat login pertama.",
      "",
    ].join("\n"),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
