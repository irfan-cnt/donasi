import "server-only";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminSessions, adminUserRoles, adminUsers, rolePermissions, roles } from "@/lib/db/schema";

export type AdminUserRow = typeof adminUsers.$inferSelect;

export async function findAdminByEmail(email: string): Promise<AdminUserRow | undefined> {
  const rows = await getDb().select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  return rows[0];
}

export async function findAdminById(id: string): Promise<AdminUserRow | undefined> {
  const rows = await getDb().select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return rows[0];
}

export async function updateAdmin(
  id: string,
  values: Partial<
    Pick<
      AdminUserRow,
      | "failedLoginCount"
      | "lockedUntil"
      | "lastLoginAt"
      | "passwordHash"
      | "mustChangePassword"
      | "totpSecretEnc"
      | "totpEnabled"
    >
  >,
): Promise<void> {
  await getDb()
    .update(adminUsers)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(adminUsers.id, id));
}

/** Role & permission admin (BR-40), dari tabel admin_user_roles → role_permissions. */
export async function loadAdminAccess(
  adminUserId: string,
): Promise<{ roles: string[]; permissions: string[] }> {
  const rows = await getDb()
    .select({ role: roles.code, permission: rolePermissions.permissionCode })
    .from(adminUserRoles)
    .innerJoin(roles, eq(roles.id, adminUserRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(adminUserRoles.adminUserId, adminUserId));
  return {
    roles: [...new Set(rows.map((r) => r.role))],
    permissions: [...new Set(rows.flatMap((r) => (r.permission ? [r.permission] : [])))],
  };
}

export type AdminSessionRow = typeof adminSessions.$inferSelect;

export async function insertAdminSession(values: {
  adminUserId: string;
  tokenHash: Buffer;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
}): Promise<void> {
  await getDb().insert(adminSessions).values(values);
}

export async function findAdminSessionByHash(
  tokenHash: Buffer,
): Promise<AdminSessionRow | undefined> {
  const rows = await getDb()
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.tokenHash, tokenHash))
    .limit(1);
  return rows[0];
}

export async function touchAdminSession(id: string, now: Date): Promise<void> {
  await getDb().update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, id));
}

export async function revokeAdminSessionByHash(tokenHash: Buffer): Promise<void> {
  await getDb()
    .update(adminSessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(adminSessions.tokenHash, tokenHash), isNull(adminSessions.revokedAt)));
}

/** Cabut semua sesi aktif admin kecuali `exceptId` (mis. setelah ganti password). */
export async function revokeOtherAdminSessions(
  adminUserId: string,
  exceptId: string,
): Promise<void> {
  await getDb()
    .update(adminSessions)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(adminSessions.adminUserId, adminUserId),
        ne(adminSessions.id, exceptId),
        isNull(adminSessions.revokedAt),
      ),
    );
}
