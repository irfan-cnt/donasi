// Bentuk baris audit_logs dari input writeAudit. Tanpa `server-only` agar dapat dipakai
// scripts/admin-create.ts (transaksinya sendiri).
import type { auditLogs } from "@/lib/db/schema";
import { diff } from "./diff";

export type AuditActor =
  | { type: "admin"; id: string }
  | { type: "donor"; id: string }
  | { type: "system" }
  | { type: "provider" };

export interface AuditInput {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  ua?: string | null;
}

export function buildAuditRow(input: AuditInput): typeof auditLogs.$inferInsert {
  const changes = diff(input.before, input.after);
  return {
    actorType: input.actor.type,
    actorId: "id" in input.actor ? input.actor.id : null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    before: changes.before,
    after: changes.after,
    metadata: input.metadata ?? null,
    ip: input.ip ?? null,
    userAgent: input.ua?.slice(0, 512) ?? null,
  };
}
