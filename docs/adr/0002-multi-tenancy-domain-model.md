# ADR 0002: Multi-tenancy & Domain Model

**Status:** Accepted

## Decisions

**Shared database, shared schema with `tenant_id`.** Every tenant-scoped table carries a `tenant_id` column (FK → `tenants.id`). All application queries include a `tenant_id` filter. PostgreSQL Row-Level Security is used as a second line of defence. One-schema-per-tenant and separate-database-per-tenant rejected — tenants are SMB merchants with no enterprise compliance or strict DB-level isolation requirement; the operational overhead doesn't pay for itself at current scale.

**Clients are platform-wide; Tenant access is tracked via `merchant_clients`.** The `clients` table has no `tenant_id` — a Client is a single platform-level record identified by PINFL. When a Tenant first registers a Client (via the Wizard), a `merchant_clients` row is created linking that Tenant to the Client. All Deals, cards, and scoring sessions remain tenant-scoped via their own `tenant_id` columns; only the identity record itself is shared. A per-tenant `clients` table was rejected: the same person taking credit from two merchants would produce two irreconcilable Client records, making cross-tenant PINFL deduplication impossible.

**Per-tenant configurable scoring model.** Each Tenant owns their scoring model — the set of factors and weights used to compute a Client's Score. A single platform-wide formula rejected: different Merchant types (electronics retail, furniture, consumer goods) have meaningfully different risk profiles. The scoring model is data, not code — it lives in the database as Tenant-owned configuration. Scoring behaviour changes without a deployment; a misconfigured model produces incorrect scores silently, so model validation is a required safeguard.

**Deal detail API uses sub-resource endpoints per tab.** `GET /deals/:id` returns the main Deal header only (deal number, dates, status, Tariff summary, basket, agent, client, Kontrakt). Each tab is a separate sub-resource:

- `GET /deals/:id/schedule` — installment schedule
- `GET /deals/:id/overdue` — overdue installments
- `GET /deals/:id/accounting` — accounting entries
- `GET /deals/:id/autopayment` — auto-payment configuration
- `GET /deals/:id/status` — lifecycle history

A single fat endpoint rejected: schedule and overdue calculations are time-dependent and expensive; splitting by tab means the server only computes what the agent opens, keeps response sizes predictable, and makes each endpoint independently cacheable.

**Soft delete for all entities.** No record is ever physically removed — deletion is a `deletedAt` timestamp. Hard delete with cascading nulls rejected: Deals must retain an immutable snapshot of the Tariff they were issued under; hard-deleting a Tariff would break Deal history. All list queries filter out soft-deleted records by default; restore is possible without data recovery.
