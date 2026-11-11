ALTER TABLE "admin_users" ADD COLUMN "totp_last_step" bigint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "checkout_authenticated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_donor_count_check" CHECK ("campaigns"."donor_count" >= 0);