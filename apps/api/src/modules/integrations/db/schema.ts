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
  responseTimeInMs: integer("response_time_in_ms"),
  requestTimestamp: timestamp("request_timestamp", { withTimezone: true }),
  responseTimestamp: timestamp("response_timestamp", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
