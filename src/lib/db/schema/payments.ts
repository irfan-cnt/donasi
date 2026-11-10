import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { campaignAmountOptions, campaigns } from "./campaigns";
import { bytea, citext, createdAt, pk, tstz, updatedAt } from "./columns";
import { donors } from "./donors";

const statusValues = [
  "created",
  "pending",
  "paid",
  "expired",
  "failed",
  "cancelled",
  "refunded",
] as const;

export const transactionStatus = pgEnum("transaction_status", statusValues);
export const paymentStatus = pgEnum("payment_status", statusValues);
export const paymentMethodType = pgEnum("payment_method_type", [
  "qris",
  "ewallet",
  "virtual_account",
  "retail",
  "card",
]);
export const eventVerification = pgEnum("event_verification", ["pending", "verified", "rejected"]);
export const eventResult = pgEnum("event_result", [
  "received",
  "processed",
  "duplicate",
  "ignored_transition",
  "amount_mismatch",
  "unknown_payment",
  "error",
]);

const money = (name: string) => bigint(name, { mode: "bigint" });

/** Tidak ada kolom kredensial (secret hanya di env). */
export const paymentProviders = pgTable(
  "payment_providers",
  {
    id: pk(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(false),
    priority: integer("priority").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("payment_providers_code_check", sql`${t.code} IN ('midtrans')`)],
);

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: pk(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => paymentProviders.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    providerChannel: text("provider_channel").notNull(),
    type: paymentMethodType("type").notNull(),
    displayName: text("display_name").notNull(),
    logoUrl: text("logo_url"),
    instructions: jsonb("instructions")
      .notNull()
      .default(sql`'[]'::jsonb`),
    minAmount: money("min_amount")
      .notNull()
      .default(sql`1000`),
    maxAmount: money("max_amount"),
    expiryMinutes: integer("expiry_minutes").notNull().default(1440),
    feeFlat: money("fee_flat")
      .notNull()
      .default(sql`0`),
    feePercent: numeric("fee_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    feeBorneBy: text("fee_borne_by", { enum: ["platform", "donor"] })
      .notNull()
      .default("platform"),
    isActive: boolean("is_active").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("payment_methods_expiry_minutes_check", sql`${t.expiryMinutes} BETWEEN 5 AND 4320`),
    check("payment_methods_fee_borne_by_check", sql`${t.feeBorneBy} IN ('platform', 'donor')`),
    unique("payment_methods_provider_code_key").on(t.providerId, t.code),
    index("payment_methods_active_order_idx").on(t.isActive, t.displayOrder),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: pk(),
    code: text("code").notNull().unique(),
    accessTokenHash: bytea("access_token_hash").notNull(),
    accessTokenExpiresAt: tstz("access_token_expires_at").notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict" }),
    donorId: uuid("donor_id")
      .notNull()
      .references(() => donors.id, { onDelete: "restrict" }),
    amountOptionId: uuid("amount_option_id").references(() => campaignAmountOptions.id, {
      onDelete: "restrict",
    }),
    amount: money("amount").notNull(),
    status: transactionStatus("status").notNull().default("created"),
    campaignTitleSnapshot: text("campaign_title_snapshot").notNull(),
    donorNameSnapshot: text("donor_name_snapshot").notNull(),
    donorEmailSnapshot: citext("donor_email_snapshot").notNull(),
    donorPhoneSnapshot: text("donor_phone_snapshot"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    prayer: text("prayer"),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    paidAt: tstz("paid_at"),
    receiptNo: text("receipt_no").unique(),
    receiptIssuedAt: tstz("receipt_issued_at"),
    source: jsonb("source"),
    ipHash: bytea("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("transactions_code_check", sql`${t.code} ~ '^TK-[0-9]{6}-[0-9A-HJKMNP-TV-Z]{6}$'`),
    check("transactions_amount_check", sql`${t.amount} BETWEEN 1000 AND 1000000000`),
    check("transactions_prayer_check", sql`char_length(${t.prayer}) <= 280`),
    check(
      "transactions_paid_at_check",
      sql`((${t.status} = 'paid') = (${t.paidAt} IS NOT NULL)) OR ${t.status} = 'refunded'`,
    ),
    index("transactions_donor_created_idx").on(t.donorId, t.createdAt.desc()),
    index("transactions_campaign_status_paid_idx").on(t.campaignId, t.status, t.paidAt.desc()),
    index("transactions_status_created_idx").on(t.status, t.createdAt),
    index("transactions_created_idx").on(t.createdAt.desc()),
    index("transactions_donor_email_idx").on(t.donorEmailSnapshot),
  ],
);

export const payments = pgTable(
  "payments",
  {
    /** = order_id / reference_id ke provider. */
    id: pk(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    paymentMethodId: uuid("payment_method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "restrict" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => paymentProviders.id, { onDelete: "restrict" }),
    providerRef: text("provider_ref"),
    amount: money("amount").notNull(),
    feeAmount: money("fee_amount")
      .notNull()
      .default(sql`0`),
    status: paymentStatus("status").notNull().default("created"),
    instruction: jsonb("instruction"),
    expiresAt: tstz("expires_at"),
    paidAt: tstz("paid_at"),
    failureReason: text("failure_reason"),
    fallbackFromId: uuid("fallback_from_id"),
    lastCheckedAt: tstz("last_checked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("payments_amount_check", sql`${t.amount} > 0`),
    foreignKey({
      name: "payments_fallback_from_id_fk",
      columns: [t.fallbackFromId],
      foreignColumns: [t.id],
    }),
    unique("payments_provider_ref_key").on(t.providerId, t.providerRef),
    // BR-11: maksimal satu payment aktif per transaksi.
    uniqueIndex("payments_one_active_per_tx_idx")
      .on(t.transactionId)
      .where(sql`${t.status} IN ('pending', 'paid')`),
    index("payments_pending_expiry_idx")
      .on(t.status, t.expiresAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: pk(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => paymentProviders.id, { onDelete: "restrict" }),
    providerEventId: text("provider_event_id"),
    paymentId: uuid("payment_id").references(() => payments.id),
    eventType: text("event_type").notNull(),
    verification: eventVerification("verification").notNull().default("pending"),
    result: eventResult("result").notNull().default("received"),
    statusReported: text("status_reported"),
    amountReported: money("amount_reported"),
    payload: jsonb("payload").notNull(),
    errorMessage: text("error_message"),
    receivedAt: tstz("received_at").notNull().defaultNow(),
    processedAt: tstz("processed_at"),
  },
  (t) => [
    unique("payment_events_provider_event_key").on(t.providerId, t.providerEventId),
    index("payment_events_payment_received_idx").on(t.paymentId, t.receivedAt.desc()),
    index("payment_events_received_idx").on(t.receivedAt.desc()),
  ],
);

export const receiptCounters = pgTable("receipt_counters", {
  year: integer("year").primaryKey(),
  lastSeq: integer("last_seq").notNull().default(0),
});
