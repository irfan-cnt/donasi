/** recordMidtransEvent terhadap DB nyata (branch Neon `dev`). Hanya berjalan bila NEON_BRANCH=dev. */
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { afterAll, describe, expect, it } from "vitest";
import { recordMidtransEvent } from "@/lib/payments/midtrans/event-log";

const ENABLED = process.env.NEON_BRANCH === "dev" && !!process.env.DATABASE_URL;

describe.skipIf(!ENABLED)("recordMidtransEvent (integration)", () => {
  const sql = neon(process.env.DATABASE_URL ?? "postgres://skip");
  const orderId = randomUUID();

  afterAll(async () => {
    await sql`DELETE FROM payment_events WHERE payload->>'testOrder' = ${orderId}`;
  });

  it("menyimpan event; order_id tak dikenal → payment_id NULL", async () => {
    await recordMidtransEvent({
      eventType: "status_check",
      orderId,
      payload: { testOrder: orderId, response: { status_code: "404" } },
      statusReported: "pending",
      amountReported: 10_000n,
    });
    const rows = await sql`
      SELECT e.event_type, e.payment_id, e.result, e.amount_reported::text AS amount, p.code
      FROM payment_events e JOIN payment_providers p ON p.id = e.provider_id
      WHERE e.payload->>'testOrder' = ${orderId}`;
    expect(rows).toEqual([
      {
        event_type: "status_check",
        payment_id: null,
        result: "processed",
        amount: "10000",
        code: "midtrans",
      },
    ]);
  });
});
