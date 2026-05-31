# Credit Scoring & POS Lending Platform

A three-party platform where **Finsum Nasiya** (capital owner) funds instalment credits issued to **Clients** at **Merchant** branches by Sales Agents.

## Language

### People

**Platform Admin**:
A Finsum Nasiya staff member who operates the admin platform. Identified by email; holds exactly one admin Role that determines access. Has no `merchant_id` or Branch scope. The breadth of access depends on the Role — only the **Superadmin** Role grants system-wide access. Provisions the elevated Merchant accounts (Branch Admins and Merchant Admins) and other Platform Admin accounts.
_Avoid_: system user, operator. (Note: **Superadmin** is a specific admin Role, not a synonym for Platform Admin.)

**Merchant**:
A business entity that operates on the platform with one or more Branches. Has its own product catalog and selects which Finsum-managed Tariffs to offer its clients.
_Avoid_: Tenant, partner, store

**Branch**:
A single physical location belonging to one Merchant. Agents are assigned to exactly one Branch. Deals and Employees are scoped to a Branch.
_Avoid_: Store, location, point-of-sale (use only as a physical description)

**Employee**:
A Merchant user account in the system. An Employee holds one or more Roles that determine their access. Identified by name, phone, and optionally PINFL. Always assigned to one Branch.
_Avoid_: Staff, user, agent, admin (use Role names instead)

**Role**:
A named set of Features. A Role belongs to one **platform** — either `merchant` (assignable to Employees) or `admin` (assignable to Platform Admins). Roles are global templates: a merchant Role applies to every Merchant's Employees (no `merchant_id` scope). Roles are custom — defined and granted Features exclusively from the admin platform — but several are seeded with stable keys and serve as defaults:
- **Agent** (`agent`, merchant) — issues Deals via the Wizard, scoped to their Branch. The only Role a Merchant Admin may assign when creating Employees.
- **Branch Admin** (`branch_admin`, merchant) — manages Agents and views Deals within one Branch.
- **Merchant Admin** (`merchant_admin`, merchant) — manages all Branches, all Employees, all Deals across the Merchant; selects active Tariffs.
- **Superadmin** (`superadmin`, admin) — implicitly holds every Feature; cannot be edited, deleted, or stripped of Features; at least one Platform Admin must always hold it. Seeded; held by the initial admin.

An Employee may hold one or more merchant Roles (a login picker selects one per session); a Platform Admin holds exactly one admin Role. A Role grants _capabilities_, not data scope — which rows an actor sees is still governed by `merchant_id` / `branch_id` / agent-owns-Deal filters, independent of the Role.
_Avoid_: access level, group, permission (use **Feature** for the unit of access)

**Feature**:
The unit of access in the permission system — a named, page/feature-level capability (e.g. `view_deals`, `manage_employees`, `manage_payments`). The full catalog of valid Features is fixed in code, one set per platform, and is the source of truth route guards enforce. A Feature is either granted to a Role or not; there is no per-field or per-record Feature.
_Avoid_: permission flag, scope, ACL entry

**Role Permission Matrix**:
The grant list (`role_permissions`, keyed by `role_id` + Feature) recording which Features each Role holds. **Default-deny**: a Role has only the Features explicitly granted to it; a newly created Role starts with none. Superadmin bypasses the table entirely. Managed exclusively from the admin platform via the Permissions page; a non-Superadmin editor may only grant Features they themselves hold and may never touch the Superadmin Role or grant `manage_roles` / `manage_admins`. The matrix is **enforced by the backend** — every guarded route checks it via a `requirePermission(feature)` guard, resolving the actor's Role to its Feature set from an in-memory cache (keyed by Role, invalidated on edit). The frontend hides UI as a convenience only. Edits take effect immediately, platform-wide.
_Avoid_: permission flags, access control list, feature flags

**Client**:
A platform-wide identity representing the end-consumer. A Client record is keyed by PINFL and exists above the Merchant boundary — the same Client can receive Deals from multiple Merchants. Carries a persistent **platform-wide credit limit** set by Finsum. A Client authenticates into the Client Portal using phone OTP; their session carries no `merchant_id` since they are not scoped to any single Merchant.
_Avoid_: Customer, buyer, borrower

### Deal flow

**Deal** (ru: Договор):
A single instalment credit issued to a Client for a Basket of goods. A Deal belongs to one Merchant and one Branch.
_Avoid_: Order, loan

**Kontrakt**:
The legal document generated from a Deal. In v1 the only type is Murabaha — a cost-plus-profit structure where Finsum Nasiya acquires goods from the Merchant at tan narxi (cost price) and resells to the Client at tan narxi + Ustama. One Deal produces one Kontrakt. Upon signing, Finsum records a payout obligation to the Merchant for the tan narxi amount. The Kontrakt is generated as a PDF (stored in MinIO, key cached on the Deal row) in the language selected by the Agent at the Верификация step (`ru` or `uz`).
_Avoid_: Contract (use Kontrakt to distinguish from the overarching Deal/Договор)

**Kontrakt Language**:
The language (`ru` or `uz`) in which the Kontrakt PDF is rendered. Selected by the Agent at the Верификация step of the Wizard before deal creation. Stored as `lang` on the Deal row. Determines which template variant is used by the PDF generator.
_Avoid_: Document language, PDF language

**Deal Signing OTP**:
A one-time code sent to the Client's phone at the Верификация step, used as the Client's digital consent to the Kontrakt terms. Distinct from the Registration OTP (purpose `client_registration`) — uses purpose `deal_signing` so codes never collide. The Agent sends the OTP, the Client reads it aloud, the Agent enters it. A `signingToken` (short-lived JWT) is returned on success and carried with the deal-creation call as proof of consent.
_Avoid_: Signing password, PIN, authentication code

**Wizard**:
The 7-step Merchant App flow a Sales Agent follows to issue a Deal: Клиент → Karta → Tarif → Mahsulot → To'lov kuni → Верификация → Готово. A Deal record (status `draft`) is created when the Agent opens the Wizard; its UUID is sent as `claim_id` on all KATM requests made during that run. Abandoned Wizard runs remain as Deal rows in `draft` status — they are never shown in reports or the UI.
_Avoid_: Form, flow, checkout

**Basket**:
The collection of one or more Products (with quantities) selected for a Deal. The Basket total must fall within the Tariff's Credit Range and must not exceed the Client's available credit balance.
_Avoid_: Cart, order, product list

### Products & pricing

**Product**:
An individual item the Merchant sells on credit — has a name, tan narxi (base cost price), MXIK code, package code, and belongs to one Category. Created by the Platform Admin or a Merchant Admin on behalf of the Merchant; both actors can edit products within their scope. Shown to the Sales Agent in the Mahsulot step of the Wizard.
_Avoid_: Catalog Item, SKU (use only as synonym), item

**MXIK Code**:
The 17-digit national product classification code assigned by the Uzbekistan State Committee of Statistics. Required on every fiscal receipt in Uzbekistan. Looked up via the external MXIK registry (`utilities.thebetacompany.uz`). Results are cached in `mxik_cache` after first lookup; search by name is only possible over previously-cached codes.
_Avoid_: Product code, SKU code, barcode

**Package Code**:
The integer identifier of the unit-of-measure packaging option selected for a Product, chosen from the list returned by the MXIK registry lookup. Stored alongside a denormalized `package_name` string on the Product record. Required for correct fiscal receipt generation.
_Avoid_: Unit code, packaging type, container code

**Tan Narxi**:
The Merchant's cost price for a Product — the amount Finsum Nasiya pays the Merchant per item upon Kontrakt signing.
_Avoid_: Base price, cost, merchant price

**Category**:
A named grouping of Products managed by an Employee with the Merchant Admin Role (e.g. Elektronika, Mebel). A Product belongs to exactly one Category. Used as a filter in the Wizard and in admin product lists.
_Avoid_: Product type, product category label

**Tariff**:
A credit plan that defines a name, number of instalment months, Ustama rate, and Credit Range. Created and managed exclusively by the Finsum platform admin. Merchant Admins select which active Tariffs to expose to their clients — they cannot create or modify Tariff parameters.
_Avoid_: Plan, scheme, package

**Ustama**:
The flat markup percentage added to each Product's tan narxi when sold on credit. Set on the Tariff by Finsum, applied uniformly across the Basket. The difference between what Finsum pays the Merchant (tan narxi) and what the Client repays (tan narxi + Ustama).
_Avoid_: Interest rate, APR, commission, fee

**Credit Range**:
The minimum and maximum allowed Basket total under a given Tariff. A Basket total must fall within the Credit Range for the Tariff to be selectable.
_Avoid_: Credit limit, loan amount, ceiling, max amount

### Credit limit

**Platform Credit Limit**:
The maximum total instalment exposure Finsum Nasiya will extend to a Client across all Merchants. Computed from KATM data and PlumGate card scoring using the global scoring model. In the Wizard flow, stored in `scoring_histories` at scoring time (a `platform_credit_limit` column on `clients` is planned but not yet implemented). In the self-service flow, stored in `user_limits`. Reduced by active Deal balances; restored automatically when a Deal is fully repaid. Only Finsum platform admin can manually refresh the base limit.
_Avoid_: Client limit, credit score limit

**Available Balance**:
The portion of a Client's Platform Credit Limit not currently committed to active Deals. Shown to Agents during the Wizard as a single number — no cross-merchant Deal breakdown is visible. In the Tarif step, only Tariffs whose Credit Range max ≤ Available Balance are shown.
_Avoid_: Remaining limit, free limit

### Scoring

**Score**:
The platform's creditworthiness value computed for a Client as a weighted criteria sum. Each criterion (income level, work contribution period, credit history, overdue counts, liabilities, demographics, and optionally Card Score) has an `ImportantLevel` multiplier and a value-band-to-score mapping. The raw sum maps through a coefficient table to determine credit limit eligibility (0 = denied, 0.8 = partial limit, 1.0 = full limit). Defined in one global scoring model owned by Finsum Nasiya. Determines the Client's Platform Credit Limit.
_Avoid_: Rating, grade, creditworthiness

**InfoScore Grade**:
The raw bureau score (0–999) returned by KATM in the `scoring_grade` field of an InfoScore (077) response. Stored on the Deal (`infoscore_raw`) for audit in the Wizard flow; stored in the Scoring Pipeline `result` jsonb for self-service scoring. The global scoring model uses granular KATM credit history fields (overdue counts, liability counts, loan applications) rather than the InfoScore Grade directly. Not the same as the platform's Score.
_Avoid_: KATM score, bureau score, scoring_grade

**Card Score**:
The scored output from PlumGate's SCORING module, derived from the Client's bank card transaction history (Uzcard or Humo). **Required** to proceed past the Karta step — the Wizard blocks until a Card Score is obtained. Contributes weighted criteria to the global scoring model. Not a replacement for KATM inputs. Not the same as the platform's Score.
_Avoid_: PlumGate score, transaction score, card scoring result, optional scoring

**Scoring Session**:
A self-service scoring request initiated by a Client through the Client portal. Keyed on `users.id` — platform-wide, no Merchant scope. Created when the Client submits KATM consent (not on page open). Its UUID serves as the `claim_id` for the KATM query and stores `consent_id` + `consent_date` directly. Tracks overall status (`pending | running | completed | failed`). Permanently separate from the Wizard scoring flow, which is Agent-driven and keyed on `clients.id`.
_Avoid_: User scoring request, scoring request, self-service session

**Scoring Pipeline**:
One step within a Scoring Session. Type is either `katm` or `card_scoring`. Tracks status (`pending | running | completed | failed`) and result (jsonb) independently. KATM always runs first — if KATM fails the session fails and card scoring never starts. Card scoring failure also fails the session. Operates at the logical step level; low-level HTTP calls are still captured in `integration_logs`.
_Avoid_: Scoring step, scoring stage

**User Limit**:
The current active Platform Credit Limit for a Client who has completed a self-service Scoring Session. One row per `users.id`, upserted after each completed session. Permanently separate from the Wizard-path limit (`scoring_histories` / future `clients.platform_credit_limit`). Read by the Client portal to display the Client's available credit. Written alongside a `scoring_histories` audit row on each completed session.
_Avoid_: Client limit (reserved for Platform Credit Limit in the Wizard flow)

**KATM**:
The Uzbekistan credit bureau. Queried during the Клиент step to retrieve a Client's existing loan obligations. Identifies individuals by **PINFL**. Queried on every new Deal; the result refreshes the Client's Platform Credit Limit.
_Avoid_: Bureau, credit check

**PINFL**:
The 14-digit national personal identification number for individuals in Uzbekistan (Персональный идентификационный номер физического лица). The primary key used to query KATM. Unique per Client — used as the deduplication key when a returning Client starts a new Deal.
_Avoid_: National ID, passport number, personal number

**KATM Consent**:
The borrower's signed consent document authorising a credit bureau query, required by UZ law №301. One Consent is collected per Deal at the start of the Wizard. Stored as `consent_id` (document number) + `consent_date` on the Deal. Both fields are sent on every KATM request for that Deal.
_Avoid_: Permission, agreement, authorisation

**KATM Demand ID**:
The 16-char system reference KATM assigns to each bureau query (`demand_id` in the response). Stored on the Deal. Used when disputing a Score with KATM or responding to a regulatory audit.
_Avoid_: Request ID, query reference

### Collections

**Collection Board** (ru: Коллекшн Борд):
A Kanban view in the Merchant Admin section showing all Deals that have at least one unpaid InstallmentScheduleRow past its due date, grouped into four Aging Buckets. Accessible to Employees with the Merchant Admin Role only. Data is derived at query time — no status is written to the Deal record.
_Avoid_: Overdue board, debt board, collections dashboard

**Aging Bucket**:
One of four time ranges used to group Deals on the Collection Board: 1–30 days, 31–60 days, 61–90 days, 90+ days. A Deal's bucket is determined by its Days Overdue value.
_Avoid_: Bucket, tier, aging group

**Days Overdue**:
The number of calendar days between today and the most recent unpaid InstallmentScheduleRow's `dueDate` (where `dueDate` ≤ today and `paid = false`). Determines which Aging Bucket a Deal appears in. Computed on demand — not stored.
_Avoid_: Overdue days, days past due, delinquency period

### Manual Payments

**Manual Payment** (ru: Ручной платёж):
A payment event entered by a Platform Admin to settle one or more InstallmentScheduleRows on a Deal outside of the automated payment channel. Stored as a single `manual_payments` row capturing: deal, admin actor, amount (tiyin), payment type (`mib` | `transfer`), optional note, and timestamp. The entered amount is applied FIFO by `dueDate` across unpaid instalments — each instalment is fully settled before the next receives any remainder; a partially covered instalment has `paidAmount` updated but `paid` remains `false`. Overpayment (amount > total remaining balance) is rejected. If the note is non-empty, a `deal_comments` row is auto-created. If all instalments become fully paid, the Deal status is set to `closed`.
_Avoid_: Cash payment, offline payment, admin payment

**InstallmentScheduleRow**:
One row in `deal_payment_schedules` — a single instalment in a Deal's repayment schedule. Has a `dueDate`, a full `amount` (tiyin), a running `paidAmount` (tiyin), a `paid` boolean (true only when `paidAmount >= amount`), and a nullable `manual_payment_id` FK pointing to the Manual Payment event that last touched it (null = settled via automated channel or not yet paid).
_Avoid_: Payment schedule row, instalment row, payment row

**Payment Type**:
The channel through which a Manual Payment was physically received. Two fixed values: `mib` (МИБ — bank transfer via Microcredit Investment Bank) and `transfer` (Перевод — generic bank transfer). Stored as a text enum on the `manual_payments` row.
_Avoid_: Payment method, payment channel

### Payouts

**Payout**:
The obligation Finsum Nasiya records toward a Merchant when a Kontrakt is signed. Amount = sum of tan narxi across all Products in the Basket. Created at signing; processed manually by the Finsum platform admin in v1.
_Avoid_: Payment to merchant, merchant transfer, disbursement

**Payout Ledger**:
The structured record of all Payout obligations per Merchant and per Branch, visible to the Finsum platform admin. Shows status (pending / paid), amount, date, and linked Deal.
_Avoid_: Settlement log, payout history

### Notifications

**Notification**:
A system-generated message delivered to exactly one actor (Employee, Client, or Platform Admin) when a notable platform event occurs. Carries a `type` and structured `params`; the frontend derives the human-readable text from these fields. Persisted for 90 days. Delivered to Employees and Platform Admins via SSE; delivered to Clients via Web Push (see ADR-0016).
_Avoid_: Alert, message, event

**Push Subscription**:
A browser-issued endpoint URL plus encryption keys (`p256dh`, `auth`) stored per `users` row in `push_subscriptions`. Represents one browser or device through which a Client can receive Web Push Notifications. One Client may hold multiple Push Subscriptions (different browsers or devices). Created when the Client enables push notifications in ProfileView; deleted when the push service returns `410` or `404` on a send attempt.
_Avoid_: Device token, FCM token, push token

**Notification Type**:
The discriminator on a Notification that identifies which event occurred. Employee types: `deal_approved`, `deal_declined`, `payment_received`, `overdue`, `new_deal`. Client types: `deal_issued`, `payment_received`, `payment_due`. Platform Admin type: `payout_pending`.
_Avoid_: Notification kind, notification category

## Relationships

- A **Merchant** has one or more **Branches**
- An **Employee** belongs to exactly one **Branch**
- A **Branch** belongs to exactly one **Merchant**
- A **Deal** belongs to one **Merchant** and one **Branch**
- A **Merchant** selects active **Tariffs** from the Finsum global Tariff catalog
- A **Tariff** defines months, **Ustama** rate, and a **Credit Range** (min + max Basket total)
- A **Deal** contains one **Basket** and one **Tariff**
- A **Basket** contains one or more **Products** with quantities; total must fall within the Tariff's **Credit Range** and must not exceed the Client's **Available Balance**
- A **Product** belongs to exactly one **Category**; a **Category** is owned by a **Merchant**
- A **Client** has one **Platform Credit Limit** and an **Available Balance** derived from it
- A **Deal** produces exactly one **Kontrakt**
- A **Kontrakt** produces exactly one **Payout** obligation toward the Merchant
- A **Deal** carries one **Score** result (stored in `client_scorings`) — set during the Tarif step
- A `users` row has at most one **User Limit** (upserted from self-service Scoring Sessions)
- A **Scoring Session** belongs to one `users` row and produces exactly two **Scoring Pipelines** (`katm`, `card_scoring`)
- A **Scoring Pipeline** belongs to exactly one **Scoring Session**
- A **Deal** carries one **DealPaymentSchedule** — set when the Deal is confirmed
- A **Deal** has zero or more **Manual Payments** entered by Platform Admins
- A **Manual Payment** touches one or more **InstallmentScheduleRows** (FIFO by due date); each row carries a nullable `manual_payment_id` back to the event
- A **Manual Payment** auto-creates a **deal_comments** row when its note is non-empty
- A **Manual Payment** that fully settles all **InstallmentScheduleRows** sets the **Deal** status to `closed`
- A **Basket** is persisted as one or more **DealItems** on the Deal
- A **Notification** belongs to exactly one actor; fan-out creates one **Notification** row per recipient at write time

## Auth identity tables

Three separate tables back the three auth flows:

| Table | Actor | Credential |
|---|---|---|
| `admin_users` | Platform Admin | Email + password |
| `merchant_users` | Employee | Email + password |
| `users` | Client | Phone + OTP (registration adds PINFL + MyID) |

`users` is an intentional divergence from the domain term "Client" — the table name was chosen for simplicity. The domain term "Client" remains correct everywhere else (code, API, UI).

## Flagged ambiguities

- "Soft skip" appeared in the Card Score definition — resolved: **Card Score is required**. The Wizard blocks at the Karta step until PlumGate scoring returns a result. There is no skip path.

- "Договор", "Сделка", and "Контракт" all appeared in the UI — resolved: **Договор = Deal** (the financing record), **Сделка** is a synonym for Deal used in tab labels only, **Контракт = Kontrakt** (the generated legal document). Never use "Contract" for the Deal itself.
- "Tenant" was used throughout the codebase — resolved: replaced by **Merchant** (business entity) and **Branch** (single location). `tenant_id` → `merchant_id`; `branch_id` added to Deals and Employees.
- "Комиссия" (Commission) appeared as a Deal field — removed from scope for v1. Not a domain concept.
- `kind` appeared in `client-portal/src/stores/notifications.ts` as the discriminator field on a Notification — resolved: canonical term is **`type`**, matching `merchant-app` and the backend schema. `kind` to be renamed.
- "Wizard Session" was a separate backend concept (a lightweight record separate from the Deal) — resolved: **merged into Deal**. A Deal is created in `draft` status when the Wizard opens. Its UUID serves as `claim_id` for KATM. The `deals` table stores `infoscore_raw`, `demand_id`, `consent_id`, and `consent_date` directly. Abandoned Wizard runs are Deal rows in `draft` status, never surfaced to users.

## Architecture Decisions

Key decisions live in `docs/adr/` as thematic files:

| File | Covers |
|---|---|
| `0001-backend-stack-architecture.md` | Node.js 25 + Fastify 5, modular monolith, REST API, Drizzle ORM, pg-boss |
| `0002-multi-tenancy-domain-model.md` | Shared DB + `merchant_id`, per-merchant product catalog, sub-resource endpoints, soft delete |
| `0003-frontend-stack-ui.md` | Turborepo monorepo, Vue 3 + PrimeVue, ClickUp dual theme, responsive design, SSE wizard progress, lazy tab queries |
| `0004-authentication-authorization.md` | Three tables (`admin_users`, `merchant_users`, `users`), scoped JWTs, client phone+OTP+MyID registration, single-role session + login picker, server-side sessions |
| `0005-integrations-infrastructure.md` | ky HTTP client factory, integration_logs table, fire-and-forget logging, PINFL/token redaction, MyID Bearer auth flow |
| `0006deployment-strategy.md` | Docker + nginx, blue-green zero-downtime backend, atomic symlink frontend, expand/contract migrations |
| `0007-observability.md` | Loki (logs) + Tempo (traces) + Prometheus (metrics) + Grafana Alloy + OpenTelemetry SDK, all self-hosted |
| `0008-katm-integration.md` | InfoScore 077 only, PINFL client ID, Deal UUID as claim_id, consent per Deal, hard block on failure, full raw jsonb stored on Deal |
| `0009-plumgate-card-scoring.md` | PlumGate SCORING module, Uzcard + Humo, Karta Wizard step, OTP agent-mediated, soft skip, client_cards token reuse, plumgate_scoring_sessions table |
| `0010-scoring-trigger-timing.md` | Scoring starts in background at Karta completion (not Tarif render); Step 3 blocks on SSE `scoring.completed`; 30 s timeout triggers retry |
| `0011-file-storage-minio.md` | MinIO (self-hosted S3) for Merchant document uploads; presigned PUT URLs; `merchant_documents` table stores URL only |
| `0012-three-party-platform-model.md` | Finsum as capital owner; Merchant + Branch hierarchy; global Tariffs and Scoring Model; persistent platform-wide Client credit limit; Merchant paid at tan narxi on signing |
| `0013-mxik-integration.md` | Backend proxy for MXIK registry; `mxik_cache` table; cache-first lookup; search is cache-only; `package_code` + `package_name` stored on Product; integration logging per ADR-0005 |
| `0014-notification-system.md` | One `notifications` table for all actor types; fan-out-at-write (one row per recipient); SSE delivery; `type`+`params` only stored (no rendered strings); 90-day TTL via pg-boss |
| `0015-self-service-scoring-flow.md` | Self-service scoring keyed on `users.id`; `scoring_sessions` + `scoring_pipelines` + `user_limits`; KATM hard block; permanently separate from Wizard scoring |
| `0016-client-web-push-notifications.md` | Web push replaces SSE for Clients; VAPID env vars; `push_subscriptions` table; manual SW; opt-in toggle in ProfileView; admin_message broadcast |

## Example dialogue

> **Agent:** "The Client wants two items — a TV and a washing machine."
> **Domain expert:** "Add both as separate **Products** to the **Basket**. As long as the total tan narxi + Ustama doesn't exceed the **Tariff's Credit Range** max and stays within the Client's **Available Balance**, the Deal can proceed."
> **Agent:** "What if they want 3 months instead of 12?"
> **Domain expert:** "That's a different **Tariff** — the Sales Agent selects the Tariff in the Tarif step. Only Tariffs whose Credit Range max fits within the Client's Available Balance are shown."
