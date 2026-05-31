# ADR-0015 — Self-Service Scoring Flow

## Status
Accepted

## Context

Clients need to score themselves through the Client portal to discover their Platform Credit Limit before approaching a Merchant. The existing scoring flow is Agent-driven: it is embedded in the Wizard, keyed on `clients.id` (Merchant-scoped), requires KATM consent collected by the Agent, and uses the Deal UUID as KATM `claim_id`.

Adding self-service scoring raises two structural questions:

1. **Identity**: the Client portal authenticates via `users` (phone + OTP), not `clients` (which is Merchant-scoped and requires a `merchant_id`). The same physical person can have multiple `clients` rows (one per Merchant) but only one `users` row.

2. **State model**: the Wizard flow stores scoring results in `scoring_histories` (append-only audit) with no dedicated current-state table. A self-service portal needs a queryable "what is my current limit?" record.

## Decision

### Identity
Self-service scoring is keyed on `users.id`. No `merchant_id` is involved. PlumGate card operations use `users.id` as the vendor `userId`, separate from the Wizard which uses `clients.id`. Cards registered via self-service are not visible in the Wizard and vice versa.

### New tables
Three tables back the self-service flow:

**`scoring_sessions`** — one row per attempt, created on consent submit:
- `id` uuid PK (doubles as KATM `claim_id`)
- `user_id` → `users.id`
- `consent_id`, `consent_date` — collected in portal UI, sent to KATM
- `status`: `pending | running | completed | failed`
- `scored_at` (nullable, set on completion)
- `created_at`

**`scoring_pipelines`** — one row per step within a session:
- `id` bigserial PK
- `session_id` → `scoring_sessions.id`
- `type`: `katm | card_scoring`
- `status`: `pending | running | completed | failed`
- `result` jsonb (nullable)
- `error` text (nullable)
- `started_at`, `completed_at` (nullable)

**`user_limits`** — current-state, one row per user (upserted):
- `user_id` → `users.id` (PK)
- `limit_amount` bigint (tiyin)
- `session_id` → `scoring_sessions.id`
- `scored_at` timestamp
- `updated_at` timestamp

### Pipeline sequencing
KATM runs first and is a hard block — failure sets the session to `failed` and the card scoring pipeline is never created. Card scoring failure also sets the session to `failed`. On completion, both `user_limits` (upserted) and `scoring_histories` (appended) are written, snapshotting data from `users`.

### Separation from Wizard scoring
The Wizard scoring path (`scoring_histories`, `clients.id`, Deal-scoped) and the self-service path (`scoring_sessions`, `users.id`, portal-scoped) remain permanently separate. Unifying the two identity models is a distinct future migration.

## Consequences

- The Client portal can show a Client's current limit with a single row lookup on `user_limits`.
- A Client who has been scored via the Wizard has no `user_limits` row; the portal must handle this gracefully.
- The `platform_credit_limit` column on `clients` (mentioned in CONTEXT.md) remains unimplemented — it is a future task, not part of this flow.
- PlumGate card tokens are not portable between the Wizard and self-service flows; a Client may need to re-add their card in the portal even if it was already registered during a Wizard run.
