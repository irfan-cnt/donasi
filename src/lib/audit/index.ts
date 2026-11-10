import "server-only";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { buildAuditRow, type AuditInput } from "./audit-row";

export type { AuditActor, AuditInput } from "./audit-row";

/**
 * Tulis satu baris audit_logs. `before`/`after` disimpan sebagai diff (field berubah saja)
 * dengan field sensitif di-redact.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await getDb().insert(auditLogs).values(buildAuditRow(input));
  } catch (err) {
    // Gagal audit tidak boleh diam-diam: log tanpa payload.
    logger.error("audit: gagal menulis", { action: input.action, error: String(err) });
    throw err;
  }
}
