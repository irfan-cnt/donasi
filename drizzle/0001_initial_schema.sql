CREATE TYPE "public"."admin_status" AS ENUM('active', 'locked', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."amount_option_kind" AS ENUM('suggested', 'package');--> statement-breakpoint
CREATE TYPE "public"."amount_type" AS ENUM('open', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'published', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."news_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."event_result" AS ENUM('received', 'processed', 'duplicate', 'ignored_transition', 'amount_mismatch', 'unknown_payment', 'error');--> statement-breakpoint
CREATE TYPE "public"."event_verification" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('qris', 'ewallet', 'virtual_account', 'retail', 'card');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'pending', 'paid', 'expired', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('created', 'pending', 'paid', 'expired', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"email" "citext" NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"default_anonymous" boolean DEFAULT false NOT NULL,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donors_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "donors_email_unique" UNIQUE("email"),
	CONSTRAINT "donors_phone_e164_check" CHECK ("donors"."phone_e164" ~ '^\+62[0-9]{8,13}$')
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "admin_user_roles" (
	"admin_user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "admin_user_roles_admin_user_id_role_id_pk" PRIMARY KEY("admin_user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" "citext" NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"status" "admin_status" DEFAULT 'active' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_code" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_code_pk" PRIMARY KEY("role_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "campaign_amount_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"kind" "amount_option_kind" NOT NULL,
	"label" text,
	"amount" bigint NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_amount_options_campaign_kind_amount_key" UNIQUE("campaign_id","kind","amount"),
	CONSTRAINT "campaign_amount_options_amount_check" CHECK ("campaign_amount_options"."amount" >= 1000)
);
--> statement-breakpoint
CREATE TABLE "campaign_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "campaign_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campaign_disbursements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"disbursed_at" date NOT NULL,
	"news_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_disbursements_amount_check" CHECK ("campaign_disbursements"."amount" > 0),
	CONSTRAINT "campaign_disbursements_kind_check" CHECK ("campaign_disbursements"."kind" IN ('program', 'operational', 'bank_fee')),
	CONSTRAINT "campaign_disbursements_description_check" CHECK (char_length("campaign_disbursements"."description") <= 500)
);
--> statement-breakpoint
CREATE TABLE "campaign_images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_news" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content_html" text NOT NULL,
	"featured_image_url" text,
	"featured_image_alt" text,
	"status" "news_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_news_campaign_slug_key" UNIQUE("campaign_id","slug"),
	CONSTRAINT "campaign_news_excerpt_check" CHECK (char_length("campaign_news"."excerpt") <= 300),
	CONSTRAINT "campaign_news_published_at_check" CHECK ("campaign_news"."status" = 'draft' OR "campaign_news"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text NOT NULL,
	"description_html" text NOT NULL,
	"featured_image_url" text,
	"featured_image_alt" text,
	"target_amount" bigint,
	"collected_amount" bigint DEFAULT 0 NOT NULL,
	"donor_count" integer DEFAULT 0 NOT NULL,
	"amount_type" "amount_type" DEFAULT 'open' NOT NULL,
	"min_amount" bigint DEFAULT 10000 NOT NULL,
	"max_amount" bigint,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug"),
	CONSTRAINT "campaigns_title_check" CHECK (char_length("campaigns"."title") BETWEEN 10 AND 120),
	CONSTRAINT "campaigns_slug_check" CHECK ("campaigns"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "campaigns_short_description_check" CHECK (char_length("campaigns"."short_description") <= 200),
	CONSTRAINT "campaigns_target_amount_check" CHECK ("campaigns"."target_amount" IS NULL OR "campaigns"."target_amount" > 0),
	CONSTRAINT "campaigns_collected_amount_check" CHECK ("campaigns"."collected_amount" >= 0),
	CONSTRAINT "campaigns_min_amount_check" CHECK ("campaigns"."min_amount" >= 1000),
	CONSTRAINT "campaigns_max_amount_check" CHECK ("campaigns"."max_amount" IS NULL OR "campaigns"."max_amount" >= "campaigns"."min_amount"),
	CONSTRAINT "campaigns_end_at_check" CHECK ("campaigns"."end_at" IS NULL OR "campaigns"."start_at" IS NULL OR "campaigns"."end_at" > "campaigns"."start_at"),
	CONSTRAINT "campaigns_seo_description_check" CHECK ("campaigns"."seo_description" IS NULL OR char_length("campaigns"."seo_description") <= 160),
	CONSTRAINT "published_requires_image" CHECK ("campaigns"."status" = 'draft' OR ("campaigns"."featured_image_url" IS NOT NULL AND "campaigns"."featured_image_alt" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" uuid NOT NULL,
	"provider_event_id" text,
	"payment_id" uuid,
	"event_type" text NOT NULL,
	"verification" "event_verification" DEFAULT 'pending' NOT NULL,
	"result" "event_result" DEFAULT 'received' NOT NULL,
	"status_reported" text,
	"amount_reported" bigint,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "payment_events_provider_event_key" UNIQUE("provider_id","provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_id" uuid NOT NULL,
	"code" text NOT NULL,
	"provider_channel" text NOT NULL,
	"type" "payment_method_type" NOT NULL,
	"display_name" text NOT NULL,
	"logo_url" text,
	"instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_amount" bigint DEFAULT 1000 NOT NULL,
	"max_amount" bigint,
	"expiry_minutes" integer DEFAULT 1440 NOT NULL,
	"fee_flat" bigint DEFAULT 0 NOT NULL,
	"fee_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"fee_borne_by" text DEFAULT 'platform' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_provider_code_key" UNIQUE("provider_id","code"),
	CONSTRAINT "payment_methods_expiry_minutes_check" CHECK ("payment_methods"."expiry_minutes" BETWEEN 5 AND 4320),
	CONSTRAINT "payment_methods_fee_borne_by_check" CHECK ("payment_methods"."fee_borne_by" IN ('platform', 'donor'))
);
--> statement-breakpoint
CREATE TABLE "payment_providers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_providers_code_unique" UNIQUE("code"),
	CONSTRAINT "payment_providers_code_check" CHECK ("payment_providers"."code" IN ('midtrans'))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"provider_ref" text,
	"amount" bigint NOT NULL,
	"fee_amount" bigint DEFAULT 0 NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"instruction" jsonb,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"fallback_from_id" uuid,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_ref_key" UNIQUE("provider_id","provider_ref"),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "receipt_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"access_token_hash" "bytea" NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"campaign_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"amount_option_id" uuid,
	"amount" bigint NOT NULL,
	"status" "transaction_status" DEFAULT 'created' NOT NULL,
	"campaign_title_snapshot" text NOT NULL,
	"donor_name_snapshot" text NOT NULL,
	"donor_email_snapshot" "citext" NOT NULL,
	"donor_phone_snapshot" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"prayer" text,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"receipt_no" text,
	"receipt_issued_at" timestamp with time zone,
	"source" jsonb,
	"ip_hash" "bytea",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_code_unique" UNIQUE("code"),
	CONSTRAINT "transactions_receipt_no_unique" UNIQUE("receipt_no"),
	CONSTRAINT "transactions_code_check" CHECK ("transactions"."code" ~ '^TK-[0-9]{6}-[0-9A-HJKMNP-TV-Z]{6}$'),
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount" BETWEEN 1000 AND 1000000000),
	CONSTRAINT "transactions_prayer_check" CHECK (char_length("transactions"."prayer") <= 280),
	CONSTRAINT "transactions_paid_at_check" CHECK ((("transactions"."status" = 'paid') = ("transactions"."paid_at" IS NOT NULL)) OR "transactions"."status" = 'refunded')
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient" text NOT NULL,
	"template_id" uuid,
	"template_version" integer,
	"transaction_id" uuid,
	"event" text NOT NULL,
	"dedup_key" text,
	"request_payload" jsonb,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"provider_response" jsonb,
	"error_message" text,
	"attempt" integer DEFAULT 0 NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_logs_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_subject_check" CHECK ("notification_templates"."channel" <> 'email' OR "notification_templates"."subject" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_actor_type_check" CHECK ("audit_logs"."actor_type" IN ('admin', 'donor', 'system', 'provider'))
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donors" ADD CONSTRAINT "donors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_code_permissions_code_fk" FOREIGN KEY ("permission_code") REFERENCES "public"."permissions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_amount_options" ADD CONSTRAINT "campaign_amount_options_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_disbursements" ADD CONSTRAINT "campaign_disbursements_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_disbursements" ADD CONSTRAINT "campaign_disbursements_news_id_campaign_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."campaign_news"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_disbursements" ADD CONSTRAINT "campaign_disbursements_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_disbursements" ADD CONSTRAINT "campaign_disbursements_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_images" ADD CONSTRAINT "campaign_images_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_news" ADD CONSTRAINT "campaign_news_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_news" ADD CONSTRAINT "campaign_news_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_category_id_campaign_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."campaign_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."payment_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."payment_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."payment_providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_fallback_from_id_fk" FOREIGN KEY ("fallback_from_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_option_id_campaign_amount_options_id_fk" FOREIGN KEY ("amount_option_id") REFERENCES "public"."campaign_amount_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donors_name_trgm_idx" ON "donors" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "admin_sessions_active_idx" ON "admin_sessions" USING btree ("admin_user_id") WHERE "admin_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "campaign_amount_options_checkout_idx" ON "campaign_amount_options" USING btree ("campaign_id","kind","sort_order") WHERE "campaign_amount_options"."is_active";--> statement-breakpoint
CREATE INDEX "campaign_disbursements_campaign_idx" ON "campaign_disbursements" USING btree ("campaign_id","disbursed_at" DESC NULLS LAST) WHERE "campaign_disbursements"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "campaign_images_campaign_sort_idx" ON "campaign_images" USING btree ("campaign_id","sort_order");--> statement-breakpoint
CREATE INDEX "campaign_news_campaign_status_published_idx" ON "campaign_news" USING btree ("campaign_id","status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "campaigns_status_published_idx" ON "campaigns" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "campaigns_category_status_published_idx" ON "campaigns" USING btree ("category_id","status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "campaigns_featured_idx" ON "campaigns" USING btree ("is_featured") WHERE "campaigns"."status" = 'published';--> statement-breakpoint
CREATE INDEX "campaigns_end_at_idx" ON "campaigns" USING btree ("end_at") WHERE "campaigns"."status" = 'published';--> statement-breakpoint
CREATE INDEX "campaigns_title_trgm_idx" ON "campaigns" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "payment_events_payment_received_idx" ON "payment_events" USING btree ("payment_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payment_events_received_idx" ON "payment_events" USING btree ("received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payment_methods_active_order_idx" ON "payment_methods" USING btree ("is_active","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_active_per_tx_idx" ON "payments" USING btree ("transaction_id") WHERE "payments"."status" IN ('pending', 'paid');--> statement-breakpoint
CREATE INDEX "payments_pending_expiry_idx" ON "payments" USING btree ("status","expires_at") WHERE "payments"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "transactions_donor_created_idx" ON "transactions" USING btree ("donor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_campaign_status_paid_idx" ON "transactions" USING btree ("campaign_id","status","paid_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_status_created_idx" ON "transactions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "transactions_created_idx" ON "transactions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_donor_email_idx" ON "transactions" USING btree ("donor_email_snapshot");--> statement-breakpoint
CREATE INDEX "notification_logs_transaction_idx" ON "notification_logs" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "notification_logs_status_created_idx" ON "notification_logs" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_active_idx" ON "notification_templates" USING btree ("event","channel") WHERE "notification_templates"."is_active";--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at" DESC NULLS LAST);