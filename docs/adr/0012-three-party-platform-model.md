# ADR 0012: Three-Party Platform Model (Finsum Nasiya / Merchant / Client)

**Status:** Accepted

## Context

The original TZ modelled the platform as a two-party system: a Merchant (Tenant) issues credit to a Client using its own tariffs and scoring model. Finsum Nasiya was implicit — the platform operator, nothing more.

The corrected model makes Finsum Nasiya an explicit third party: the capital owner that funds all deals, bears all collection risk, and owns the credit policy. This session resolves the architectural consequences of that change.

---

## Decisions

### 1. Finsum Nasiya owns global Tariffs and the global Scoring Model

Tariffs (installment months, Ustama rate, Credit Range) and the scoring model (criteria weights, coefficient table) are configured by the Finsum platform admin and apply to every Deal on the platform.

Per-merchant tariff configuration rejected: Finsum bears all credit risk — letting individual Merchants influence pricing or scoring criteria would expose Finsum to uncontrolled risk. Merchants may only select which Finsum-managed Tariffs they wish to offer their clients; they cannot create or modify Tariff parameters.

### 2. Agent → Branch → Merchant hierarchy

A Merchant is a multi-branch business entity. A Branch is a single physical location belonging to one Merchant. An Agent (Employee with Agent Role) belongs to one Branch. Every Deal is tagged with both `branch_id` and `merchant_id`.

One-merchant-one-location model rejected: real merchant businesses operate multiple storefronts; forcing one account per branch creates duplicated onboarding, disconnected reporting, and unmanageable Merchant Admin experience.

### 3. Two merchant-side admin levels

**Branch Admin** — scoped to one Branch: manages that Branch's Agents, sees that Branch's Deals.  
**Merchant Admin** — scoped to the full Merchant: manages all Branches, all Agents, sees all Deals across every Branch.

A single flat admin role rejected: a Merchant Admin at HQ should not need to log in as each Branch Admin to see the full picture; a Branch Admin should not be able to see or modify sibling branches they don't manage.

### 4. Finsum pays Merchant at tan narxi immediately on Kontrakt signing

When a Kontrakt is signed, Finsum Nasiya is recorded as the buyer of the goods at the Merchant's tan narxi (cost price). The payout obligation is created at that moment. Finsum then holds the credit receivable against the Client.

Proportional payout (per installment received) rejected: the Murabaha structure requires the seller (Merchant) to transfer ownership of goods at signing. Deferring payment contradicts the legal structure and creates reconciliation complexity with no benefit to Finsum.

### 5. Merchant manages their own Product catalog

Each Merchant maintains its own Product catalog (names, categories, tan narxi prices). Finsum reads the Basket total for payout calculation but does not own or manage individual product records.

Global shared catalog rejected: different Merchants sell different goods at different prices; a shared catalog is unmanageable at scale and provides no benefit since Finsum only needs the total Basket value, not individual item semantics.

### 6. One global Scoring Model, owned by Finsum

A single scoring model applies to all Clients regardless of which Merchant's Branch they visit. The platform admin (Finsum) configures and updates it.

Per-merchant scoring models rejected: Finsum is the sole credit risk bearer. There is no business justification for a Merchant to influence how its customers are scored when Finsum funds every Deal.

### 7. Persistent platform-wide Client credit limit

A Client has one credit limit record on the platform, computed from KATM + PlumGate data and the global scoring model. Active Deals reduce the available balance. The limit persists across Wizard sessions and is visible to any Merchant's Agent as a single remaining-balance number.

Per-deal limit (re-scored fresh each Wizard) rejected: *"platforma orqali limit oladi"* — the Client's limit is a platform-level asset. Re-scoring on every Wizard wastes KATM quota and introduces inconsistency when the same Client visits two branches on the same day.

### 8. Agents see only the remaining available limit — no cross-merchant deal detail

When an Agent opens a Wizard for a Client, they see one number: the Client's current available credit balance. They do not see how many active Deals exist, at which Merchants, or for what amounts.

Cross-merchant deal summary rejected: Merchants are commercial competitors. Exposing deal metadata (even aggregated) across Merchant boundaries violates data isolation and gives one Merchant insight into another's sales volume.

### 9. KATM queried on every new Deal; result refreshes the stored limit

KATM is queried once per Wizard, consent is collected at the Клиент step as today (required by UZ law №301). The resulting Score and credit limit calculation refreshes the Client's stored platform limit as a side effect.

Query-only-on-first-registration rejected: law №301 requires fresh consent per credit application regardless of whether a stored limit exists. Skipping KATM on returning Clients creates legal exposure.

### 10. "Tenant" dropped; domain language is Merchant and Branch

The term "Tenant" is removed from the domain model and CONTEXT.md. The platform is multi-merchant (data isolation enforced by `merchant_id`). Sub-location isolation uses `branch_id`. All tables previously using `tenant_id` are migrated to `merchant_id`; Deals and Employees also carry `branch_id`.

Keeping "Tenant" rejected: the word is a technical abstraction invisible to Finsum, Merchants, and Agents. "Merchant" and "Branch" are the words everyone already uses; the domain language should match.

### 11. Finsum platform admin gains four new capability areas (all in scope for v1)

| Area | What it replaces |
|---|---|
| **Tariff management** | Was per-Tenant Merchant Admin; now owned by Finsum platform admin |
| **Scoring model management** | Was per-Tenant; now one global model managed by platform admin |
| **Client limit dashboard** | New — view and manually refresh any Client's platform credit limit |
| **Merchant payout ledger** | New — structured record of every Kontrakt → tan narxi payout obligation per Merchant |

All four in v1: Tariffs and scoring model are unblockable (no one else can manage them). Payout ledger is mandatory because Finsum creates a payout obligation on every signing. Client limit dashboard is minimal for v1 — view + manual refresh only.
