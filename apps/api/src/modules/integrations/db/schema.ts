import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const integrationLogs = pgTable("integration_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  integration: text("integration").notNull(),
  methodName: text("method_name").notNull(),
  methodType: text("method_type").notNull(),
  request: jsonb("request"),
  response: jsonb("response"),
  status: integer("status"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
