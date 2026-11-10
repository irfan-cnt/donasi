ALTER TABLE "transactions" ADD COLUMN "receipt_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "receipt_hash" "bytea";