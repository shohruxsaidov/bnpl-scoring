import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { clients, users } from "../../id/db/schema";

export const integrationLogs = pgTable(
  "integration_logs",
  {
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
  },
  (table) => [
    index("integration_logs_request_timestamp_idx").on(table.requestTimestamp),
    index("integration_logs_integration_idx").on(table.integration),
  ],
);

// ---------------------------------------------------------------------------
// KATM Claim ID sequence (ADR-0025). One shared sequence feeds katm_claim_id
// on both deal_sessions and scoring_sessions — KATM's pClaimId is String(20),
// so the session UUIDs cannot be used.
// ---------------------------------------------------------------------------
export const katmClaimSeq = pgSequence("katm_claim_seq", { startWith: 1000 });

// ---------------------------------------------------------------------------
// katm_consents — the auditable artifact behind pAgreementId/pAgreementDate
// (ADR-0025). One row per bureau-query consent: who consented, when, through
// which run, and via which channel. The row id is sent as pAgreementId; there
// is no paper document.
// ---------------------------------------------------------------------------
export const katmConsents = pgTable("katm_consents", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  // Exactly one of the two subjects is set, matching the channel
  clientId: bigint("client_id", { mode: "bigint" }).references(() => clients.id),
  userId: bigint("user_id", { mode: "bigint" }).references(() => users.id),
  // 'wizard' | 'self_service'
  channel: varchar("channel", { length: 20 }).notNull(),
  // The owning run — deal_sessions.id or scoring_sessions.id (no FK: the
  // scoring session row is created after the consent in the self-service flow)
  sessionId: uuid("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
