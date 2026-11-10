import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { paymentEvents } from "@/lib/db/schema";

export type MidtransEventType =
  "create_request" | "create_error" | "status_check" | "expire_request";

export interface MidtransEventRecord {
  eventType: MidtransEventType;
  /** order_id; dihubungkan ke payments.id hanya bila barisnya ada. */
  orderId: string;
  /** Sudah ter-redaksi. */
  payload: unknown;
  statusReported?: string;
  amountReported?: bigint;
  errorMessage?: string;
}

export type RecordMidtransEvent = (event: MidtransEventRecord) => Promise<void>;

/** Simpan interaksi API ke payment_events (provider_event_id NULL → tidak bentrok dedup webhook). */
export const recordMidtransEvent: RecordMidtransEvent = async (e) => {
  await getDb()
    .insert(paymentEvents)
    .values({
      providerId: sql`(SELECT id FROM payment_providers WHERE code = 'midtrans')`,
      paymentId: z.uuid().safeParse(e.orderId).success
        ? sql`(SELECT id FROM payments WHERE id = ${e.orderId}::uuid)`
        : null,
      eventType: e.eventType,
      verification: "verified",
      result: e.errorMessage ? "error" : "processed",
      statusReported: e.statusReported ?? null,
      amountReported: e.amountReported ?? null,
      payload: e.payload as object,
      errorMessage: e.errorMessage ?? null,
      processedAt: sql`now()`,
    });
};
