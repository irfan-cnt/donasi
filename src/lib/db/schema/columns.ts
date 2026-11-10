import { customType, timestamp, uuid } from "drizzle-orm/pg-core";
import { newId } from "@/lib/id";

/** Ekstensi `citext` — dibuat di migrasi manual 0000_extensions.sql. */
export const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/** PK uuid; nilai UUIDv7 dibuat aplikasi (bukan default DB). */
export const pk = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => newId());

export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const createdAt = () => tstz("created_at").notNull().defaultNow();
export const updatedAt = () => tstz("updated_at").notNull().defaultNow();
