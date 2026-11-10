import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { citext, createdAt, pk, tstz, updatedAt } from "./columns";

export const donors = pgTable(
  "donors",
  {
    id: pk(),
    userId: uuid("user_id")
      .unique()
      .references(() => users.id, { onDelete: "set null" }),
    email: citext("email").notNull().unique(),
    name: text("name").notNull(),
    phoneE164: text("phone_e164"),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    defaultAnonymous: boolean("default_anonymous").notNull().default(false),
    anonymizedAt: tstz("anonymized_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("donors_phone_e164_check", sql`${t.phoneE164} ~ '^\\+62[0-9]{8,13}$'`),
    index("donors_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
  ],
);
