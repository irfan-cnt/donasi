import { sql } from "drizzle-orm";
import { bigint, check, index, inet, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin";
import { createdAt, tstz } from "./columns";

/** Append-only: app_rw hanya INSERT/SELECT (scripts/db-roles.sql). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    actorType: text("actor_type", { enum: ["admin", "donor", "system", "provider"] }).notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata"),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "audit_logs_actor_type_check",
      sql`${t.actorType} IN ('admin', 'donor', 'system', 'provider')`,
    ),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId, t.createdAt.desc()),
    index("audit_logs_actor_idx").on(t.actorId, t.createdAt.desc()),
  ],
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => adminUsers.id),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});
