import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  inet,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, citext, createdAt, pk, tstz, updatedAt } from "./columns";

export const adminStatus = pgEnum("admin_status", ["active", "locked", "disabled"]);

export const adminUsers = pgTable("admin_users", {
  id: pk(),
  email: citext("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  status: adminStatus("status").notNull().default("active"),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: tstz("locked_until"),
  lastLoginAt: tstz("last_login_at"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: pk(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: bytea("token_hash").notNull().unique(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: tstz("last_seen_at").notNull().defaultNow(),
    expiresAt: tstz("expires_at").notNull(),
    revokedAt: tstz("revoked_at"),
  },
  (t) => [
    index("admin_sessions_active_idx")
      .on(t.adminUserId)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
);

export const roles = pgTable("roles", {
  id: pk(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
});

export const permissions = pgTable("permissions", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionCode: text("permission_code")
      .notNull()
      .references(() => permissions.code),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionCode] })],
);

export const adminUserRoles = pgTable(
  "admin_user_roles",
  {
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
  },
  (t) => [primaryKey({ columns: [t.adminUserId, t.roleId] })],
);
