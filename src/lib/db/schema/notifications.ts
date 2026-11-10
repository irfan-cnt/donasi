import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { adminUsers } from "./admin";
import { createdAt, pk, tstz, updatedAt } from "./columns";
import { transactions } from "./payments";

export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp"]);
export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: pk(),
    event: text("event").notNull(),
    channel: notificationChannel("channel").notNull(),
    name: text("name").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    version: integer("version").notNull().default(1),
    updatedBy: uuid("updated_by").references(() => adminUsers.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "notification_templates_subject_check",
      sql`${t.channel} <> 'email' OR ${t.subject} IS NOT NULL`,
    ),
    // BR-30: satu template aktif per (event, channel).
    uniqueIndex("notification_templates_active_idx")
      .on(t.event, t.channel)
      .where(sql`${t.isActive}`),
  ],
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: pk(),
    channel: notificationChannel("channel").notNull(),
    recipient: text("recipient").notNull(),
    templateId: uuid("template_id").references(() => notificationTemplates.id, {
      onDelete: "set null",
    }),
    templateVersion: integer("template_version"),
    transactionId: uuid("transaction_id").references(() => transactions.id),
    event: text("event").notNull(),
    /** event:transaction:channel */
    dedupKey: text("dedup_key").unique(),
    requestPayload: jsonb("request_payload"),
    status: notificationStatus("status").notNull().default("queued"),
    providerResponse: jsonb("provider_response"),
    errorMessage: text("error_message"),
    attempt: integer("attempt").notNull().default(0),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: createdAt(),
    sentAt: tstz("sent_at"),
  },
  (t) => [
    index("notification_logs_transaction_idx").on(t.transactionId),
    index("notification_logs_status_created_idx").on(t.status, t.createdAt.desc()),
  ],
);
