# Credit Scoring & POS Lending Platform

A three-party platform where **Finsum Nasiya** (capital owner) funds instalment credits issued to **Clients** at **Merchant** branches by Sales Agents.

## Language

### People

**Platform Admin**:
A Finsum Nasiya staff member who operates the admin platform. Identified by email; holds exactly one admin Role that determines access. Has no `merchant_id` or Branch scope. The breadth of access depends on the Role — only the **Superadmin** Role grants system-wide access. Provisions the elevated Merchant accounts (Branch Admins and Merchant Admins) and other Platform Admin accounts.
_Avoid_: system user, operator. (Note: **Superadmin** is a specific admin Role, not a synonym for Platform Admin.)

**Merchant**:
A business entity that operates on the platform with one or more Branches. Has its own product catalog and selects which Finsum-managed Tariffs to offer its clients. Carries a **KYB Status**.
_Avoid_: Tenant, partner, store

**KYB Status** (Know Your Business):
The Finsum-managed verification state of a Merchant. Three values: `pending` (submitted, awaiting review), `verified` (approved — may issue Deals), `rejected` (not approved). Stored as `kyb_status` on the `merchants` row. All Merchants created before KYB was introduced are seeded as `verified`. Managed exclusively by Platform Admins.
_Avoid_: verification status, approval status, merchant status

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

**Contract**:
The legal document generated from a Deal. In v1 the only type is Murabaha — a cost-plus-profit structure where Finsum Nasiya acquires goods from the Merchant at tan narxi (cost price) and resells to the Client at tan narxi + Ustama. One Deal produces one Contract. Upon signing, Finsum records a Buyout obligation to the Merchant for the tan narxi amount. The Contract is generated as a PDF (stored in MinIO via the file-storage lib) in the language selected by the Agent at the Верификация step (`ru` or `uz`).
_Avoid_: Contract

**Contract Language**:
The language (`ru` or `uz`) in which the Contract PDF is rendered. Selected by the Agent at the Верификация step of the Wizard before deal creation. Stored as `lang` on the Deal row. Determines which template variant is used by the PDF generator.
_Avoid_: Document language, PDF language

**Deal Signing OTP**:
A one-time code sent to the Client's phone at the Верификация step, used as the Client's digital consent to the Contract terms. Distinct from the Registration OTP (purpose `client_registration`) — uses purpose `deal_signing` so codes never collide. The Agent sends the OTP, the Client reads it aloud, the Agent enters it. A `signingToken` (short-lived JWT) is returned on success and carried with the deal-creation call as proof of consent.
_Avoid_: Signing password, PIN, authentication code

**Wizard**:
The 7-step Merchant App flow a Sales Agent follows to issue a Deal: Клиент → Card → Tariff → Products → To'lov kuni → Верификация → Готово. The canonical step identifiers are English (`client`, `card`, `tariff`, `products`, `payment`, `verification`); on-screen labels stay localized (Karta, Tarif, Mahsulot, …). Opening the Wizard creates a Deal Session; the Deal itself is created only at the Верификация step.
_Avoid_: Form, flow, checkout

**Deal Session**:
The persistent record of a single Wizard run, created the moment an Agent opens the Wizard — before a Client is even identified. It carries the run's current state (so a run can be resumed from any device) and an immutable trail of every step submission, including steps the Agent later went back and redid. Belongs to one Merchant, Branch, and Agent. Its UUID is sent as `claim_id` on all KATM requests made during the run. Completing the Wizard produces a Deal linked back to its Deal Session; abandoned Deal Sessions are kept for funnel analytics and audit and are never shown as Deals.
_Avoid_: wizard session, draft deal, claim

**Basket**:
The collection of one or more Products (with quantities) selected for a Deal. The Basket total must fall within the Tariff's Credit Range and must not exceed the Client's available credit balance.
_Avoid_: Cart, order, product list

### Products & pricing

**Product**:
An individual item the Merchant sells on credit — has a name, tan narxi (base cost price), MXIK code, package code, and belongs to one Category. Created by the Platform Admin or a Merchant Admin on behalf of the Merchant; both actors can edit products within their scope. Shown to the Sales Agent in the Products step of the Wizard.
_Avoid_: Catalog Item, SKU (use only as synonym), item

**MXIK Code**:
The 17-digit national product classification code assigned by the Uzbekistan State Committee of Statistics. Required on every fiscal receipt in Uzbekistan. Looked up via the external MXIK registry (`utilities.thebetacompany.uz`). Results are cached in `mxik_cache` after first lookup; search by name is only possible over previously-cached codes.
_Avoid_: Product code, SKU code, barcode

**Package Code**:
The integer identifier of the unit-of-measure packaging option selected for a Product, chosen from the list returned by the MXIK registry lookup. Stored alongside a denormalized `package_name` string on the Product record. Required for correct fiscal receipt generation.
_Avoid_: Unit code, packaging type, container code

**Tan Narxi**:
The Merchant's cost price for a Product — the amount Finsum Nasiya pays the Merchant per item upon Contract signing.
_Avoid_: Base price, cost, merchant price

**Category**:
A named grouping of Products managed by an Employee with the Merchant Admin Role (e.g. Elektronika, Mebel). A Product belongs to exactly one Category. Used as a filter in the Wizard and in admin product lists.
_Avoid_: Product type, product category label

**Tariff**:
A credit plan that defines a name, number of instalment months, Ustama rate, and Credit Range. Created and managed exclusively by the Finsum platform admin. Merchant Admins select which active Tariffs to expose to their clients — they cannot create or modify Tariff parameters. A Tariff is purely a pricing construct: it plays no role in scoring, which resolves its **Scoring Model** from the Merchant (or the **Global Model**), never from the Tariff.
_Avoid_: Plan, scheme, package

**Ustama**:
The flat markup percentage added to each Product's tan narxi when sold on credit. Set on the Tariff by Finsum, applied uniformly across the Basket. The difference between what Finsum pays the Merchant (tan narxi) and what the Client repays (tan narxi + Ustama).
_Avoid_: Interest rate, APR, commission, fee

**Credit Range**:
The minimum and maximum allowed Basket total under a given Tariff. Either bound may be absent, meaning the Tariff is unbounded on that side; legacy Tariffs have no bounds at all. Enforced when the Basket is built (the Agent cannot proceed past the Products step with a total outside the chosen Tariff's range) and again at Deal creation. Tariffs whose minimum exceeds the Client's Available Balance are not offered in the Tariff step.
_Avoid_: Credit limit, loan amount, ceiling, max amount

**Tariff Calculator** (uz: Tariff kalkulyator):
A standalone Merchant App page where an Agent enters a hypothetical purchase amount and sees a Tariff Quote for every merchant-active Tariff side by side, to advise a Client before starting the Wizard. Purely informational: it involves no Client, runs no scoring, and creates no Deal. Tariffs whose Credit Range excludes the entered amount are flagged as unavailable, not hidden. Accessible to anyone holding the `create_deal` Feature.
_Avoid_: Price calculator, loan calculator, simulator, credit calculator

**Tariff Quote**:
The computed repayment preview for one Tariff and one amount: the per-month instalment amounts (the final month absorbs the rounding remainder), the total payable, and the Ustama amount in so'm. Guaranteed to match the instalment schedule a real Deal with the same amount and Tariff would produce. Carries no due dates — those depend on the payment day and signing date, which exist only on a real Deal.
_Avoid_: Estimate, simulation, preview schedule, offer

### Credit limit

**Platform Credit Limit**:
The maximum total instalment exposure Finsum Nasiya will extend to a Client across all Merchants. A single number per Client: each scoring run computes it with the Scoring Model resolved for that run (the Merchant's assigned model, else the Global Model), and the most recent run's result is the Client's current limit — even when consecutive runs at different Merchants resolve to different models. Computed by the Scoring Model engine as **Limit Coefficient × Base Limit** — PlumGate card scoring plays no part (it is audit-only; see Card Score). In the Wizard flow, stored in `scoring_histories` at scoring time (a `platform_credit_limit` column on `clients` is planned but not yet implemented). In the self-service flow, stored in `user_limits`. Reduced by active Deal balances; restored automatically when a Deal is fully repaid. Only Finsum platform admin can manually refresh the base limit.
_Avoid_: Client limit, credit score limit

**Available Balance**:
The portion of a Client's Platform Credit Limit not currently committed to active Deals. Shown to Agents during the Wizard as a single number — no cross-merchant Deal breakdown is visible. In the Tariff step, only Tariffs whose Credit Range min ≤ Available Balance are shown — the Client must be able to afford at least the Tariff's minimum.
_Avoid_: Remaining limit, free limit

### Scoring

**Scoring Model**:
A named scoring configuration owned by Finsum Nasiya, materialised as an append-only family of Scoring Model Revisions. A Merchant may optionally be assigned a Scoring Model; Merchants without one (and all self-service runs) score against the **Global Model**. Scoring always resolves to the assigned model's latest revision — Merchants never reference an individual revision, so model edits take effect for all assigned Merchants immediately.
_Avoid_: scoring scheme, model family, merchant model (it is owned by Finsum, only assigned to a Merchant)

**Global Model**:
The single Scoring Model marked as the platform-wide default. Exactly one Scoring Model is Global at all times: marking another model Global atomically unmarks the previous one, the mark cannot be removed without choosing a successor, and the Global Model cannot be deleted. Used for every scoring run that has no Merchant-assigned model, including all self-service runs.
_Avoid_: globally active model (the "active" revision is a different concept), default model, fallback model

**Scoring Model Revision**:
An immutable, versioned snapshot of the full scoring configuration (Stop Factors, Scoring Parameters, Limit Coefficient table) belonging to one Scoring Model. Revisions are append-only; within each model the most recently created revision is the **active** one. Saving a new revision makes it live immediately for all subsequent scoring runs that resolve to its model. Each scoring run records which revision produced its decision.
_Avoid_: scoring model version, model config, per-tariff model

**Score**:
The platform's creditworthiness value computed for a Client as a weighted sum of Scoring Parameters. Each Scoring Parameter has an `ImportantLevel` multiplier (0, 0.5, or 1) and a value-to-score mapping. The raw sum maps through the Limit Coefficient table to determine credit limit eligibility (0 = denied, 0.8 = partial limit, 1.0 = full limit). Defined in the active Scoring Model Revision owned by Finsum Nasiya. Determines the Client's Platform Credit Limit. If any Stop Factor matches, scoring is aborted and the Client is rejected before a Score is computed.
_Avoid_: Rating, grade, creditworthiness

**Stop Factor**:
A hard-rejection condition declared in the Scoring Model Revision and evaluated before any scoring begins. Defined by a boolean match key (e.g. `WithJuridical`, `WithDecommission`). If any Stop Factor with `Reject: true` matches, the engine returns a rejection result immediately — no Score is computed and no Scoring Parameters are evaluated. Current Stop Factors: active judicial proceedings (`Juridical`) and decommissioned/written-off debt (`DeCommissioned`).
_Avoid_: blocking criterion, negative score, stop criterion

**Scoring Parameter**:
A named, typed criterion within a Scoring Model Revision that contributes a weighted score to the Client's total Score. Three types: `range` (numeric value mapped to a score via half-open `[From, To)` bands), `categorical` (enum key mapped to a score), `regionMatch` (region code matched against a whitelist). Each parameter has an `ImportantLevel` multiplier and an `Enabled` flag. Disabled parameters are skipped (contribute 0). Some range parameters have a `NotApplicable` score for when the condition does not apply (e.g. Client is not a co-borrower).
_Avoid_: scoring criterion, scoring field, model parameter

**Limit Coefficient**:
The output multiplier table in a Scoring Model Revision that converts a total Score into a credit limit factor. Uses half-open `[From, To)` score bands, each mapping to a `Coefficient` (0 = denied, 0.8 = partial, 1.0 = full). Applied after all Scoring Parameters are summed; the resulting coefficient multiplies the **Base Limit** to produce the Platform Credit Limit. Stored as a top-level section in the model alongside `StopFactors` and `ScoringParams`.
_Avoid_: LimitSum, score-to-limit table, coefficient table

**Base Limit**:
The platform-wide maximum credit amount declared in a Scoring Model Revision. The Platform Credit Limit is computed as Limit Coefficient × Base Limit. A single constant for all Clients until income-derived limits become possible (INPS/GNK data is not yet available — see Skipped Parameter). Versioned and validated with the revision like every other model section. **Deliberate consequence**: while the income parameters are skipped, the maximum reachable Score is 700 — below the 750 needed for coefficient 1.0 — so the best outcome any Client can receive is 0.8 × Base Limit. Finsum sets the Base Limit with this cap in mind.
_Avoid_: max limit, default limit, limit cap

**Skipped Parameter**:
A Scoring Parameter that contributed 0 to a scoring run because its input value was not given (`undefined`) or the parameter was disabled. Recorded per-run in the persisted breakdown. Scoring-history views must surface skipped parameters as a **warning** so reviewers can see which data was missing when the decision was made. Currently always skipped platform-wide: `IncomeSum` and `WorkExperience` (no INPS/GNK integration yet) and `PassportData` (registration address is not captured at MyID onboarding). `MonthlyAveragePayment` is additionally `Enabled: false` in the model itself. All other parameters are computed from the KATM raw payload and the Client record on every run.
_Avoid_: missing parameter, null criterion, disabled parameter (that is the `Enabled` flag, a different cause with the same effect)

**Scoring Test Case**:
A named, global set of `ScoringInputs` with an **Expected Outcome** used to validate Scoring Model Revisions. Not tied to any specific revision — the same suite runs against any revision for comparison. Created and managed by Platform Admins. A test case also records the actual outcome of the most recent run so it can serve as a baseline for the next run.
_Avoid_: test input, scoring profile, model test

**Decision**:
The recorded outcome of a production scoring run. Exactly four values, shared verbatim with Expected Outcome: `approved` (coefficient 1.0), `partial` (coefficient 0.8), `denied` (coefficient 0), `rejected` (a Stop Factor fired before scoring). A Deal may proceed on `approved` or `partial`; it is blocked on `denied` or `rejected`. There is no manual-review tier. Historical rows written before the engine integration carry the legacy PlumGate vocabulary (`approved` / `manual_review` / `declined`) and are read-tolerated, never rewritten.
_Avoid_: status, verdict, manual_review (legacy), declined (legacy — use `denied` or `rejected`)

**Expected Outcome**:
The approval-tier assertion on a Scoring Test Case. One of four values: `approved` (coefficient = 1.0), `partial` (coefficient = 0.8), `denied` (coefficient = 0), or `rejected` (a Stop Factor fired before scoring). A test case **passes** when the actual outcome of running the Scoring Model engine matches the Expected Outcome.
_Avoid_: expected score, expected coefficient, expected result

**Scoring Test Run**:
A recorded execution of the full Scoring Test Case suite against a specific Scoring Model Revision. Stores the actual outcome, `totalScore`, `coefficient`, and per-parameter breakdown for each test case, plus a pass/fail result. Saved permanently so Finsum can compare how different revisions affect credit decisions. A run can also be used to capture current outcomes as the new Expected Outcomes (baseline capture).
_Avoid_: test execution, model run, scoring run

**InfoScore Grade**:
The raw bureau score (0–999) returned by KATM in the `scoring_grade` field of an InfoScore (077) response. Stored on the Deal (`infoscore_raw`) for audit in the Wizard flow; stored in the Scoring Pipeline `result` jsonb for self-service scoring. The global scoring model uses granular KATM credit history fields (overdue counts, liability counts, loan applications) rather than the InfoScore Grade directly. Not the same as the platform's Score.
_Avoid_: KATM score, bureau score, scoring_grade

**Card Score**:
The scored output from PlumGate's SCORING module, derived from the Client's bank card transaction history (Uzcard or Humo). **Audit-only**: recorded in `criteria_scores` for traceability and shadow-comparison against the engine's decision, but it has no effect on the Score, the Limit Coefficient, or the Platform Credit Limit — the Scoring Model engine is the sole credit authority. Card registration remains **required** to proceed past the Card step (the card is the Client's payment instrument), and the SCORING call still runs, but a PlumGate `declined` does not stop anything. Not the same as the platform's Score.
_Avoid_: PlumGate score, transaction score, card scoring result, optional scoring, scoring input

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

### Geography

**Region**:
A top-level geographic administrative unit in Uzbekistan (oblast), such as "Андижанская область". Used to classify the location of a Merchant or Branch. Seeded from `references/regions.json` (finsum.uz source); 15 entries. Stored in the `regions` table with `upper_id IS NULL`.
_Avoid_: Oblast, province

**District**:
A second-level geographic unit (rayon) belonging to exactly one Region, such as "Алтынкульский район". Stored in the `regions` table with `upper_id` pointing to its parent Region. 205 entries seeded from the same source.
_Avoid_: Rayon, sub-region, city

### Platform identity

**Organization**:
The singleton record of **Finsum Nasiya's own legal requisites** — the platform operator's display name, legal name, address, phone, INN, MFO (with bank name resolved via the CBU Bank Registry), and Account Number. Exactly one exists platform-wide; it is never a Merchant. All fields are required — the record either exists complete or not at all. Managed by Platform Admins holding `manage_settings`. Its requisites print in the supplier block of every Contract; the legal name and address are entered once and rendered as-is regardless of Contract Language. While no Organization exists, Contracts print "—" for every supplier field and the admin platform shows a warning prompting completion.
_Avoid_: company, tenant, merchant (an Organization is the operator, not a Merchant), org profile

### Bank information

**Merchant Bank Account**:
The payment destination recorded for a Merchant, used to process Buyout disbursements. Consists of MFO, account number, and bank name. One per Merchant; optional at creation, added later. All three fields are stored directly on the `merchants` row — `bank_name` is denormalized from the CBU lookup result at save time.
_Avoid_: Bank details, payment info, settlement account

**MFO** (Межфилиальный оборот):
The 5-digit Uzbekistan interbank routing code that identifies the Merchant's bank. Resolved to a human-readable bank name via the CBU (Central Bank of Uzbekistan) bank registry. Must be exactly 5 digits; validated at the API level.
_Avoid_: Bank code, routing code, branch code

**Account Number** (номер счета):
The 20-digit Merchant bank account number. Must be exactly 20 digits; validated at the API level.
_Avoid_: IBAN, account ID

**CBU Bank Registry**:
The Central Bank of Uzbekistan's published branch directory (dataset 4-009-0010, `https://cbu.uz/upload/open_data/0010/4-009-0010_uz.json`). Each entry has a `Filialkodi` (MFO) and `Filialnomi` (branch name). Fetched by the backend on first request and cached in `bank_mfo_cache`. Cache is on-demand only — no automatic refresh; a Platform Admin triggers a manual re-fetch if the list is stale.
_Avoid_: Bank list, MFO directory

### Buyouts

**Buyout** (ru: Выкуп):
The obligation Finsum Nasiya records toward a Merchant when a Contract is signed — the amount Finsum owes the Merchant for acquiring the goods. Amount = sum of (tan narxi × quantity) across all DealItems in the Basket. Created atomically with the Deal; processed manually by the Platform Admin. Two statuses: `pending` (obligation recorded, not yet paid) and `paid` (Merchant has been paid).
_Avoid_: Payout, payment to merchant, disbursement

**Buyout Ledger** (ru: Выкупы):
The structured record of all Buyout obligations across all Merchants and Branches, visible to the Platform Admin. Shows status, amount, linked Deal, Agent, Client, Branch, and date.
_Avoid_: Payout ledger, settlement log

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

### Integrations

**Integration Log**:
An immutable audit record of one outbound call to an external service (KATM, MyID, Plumgate, MXIK). Captures the integration name, method name and type, redacted request/response payloads, HTTP status, error message, and request/response timestamps. Written fire-and-forget by every integration client — a log write failure never affects the call itself. Sensitive values (tokens, secrets, full PINFLs) are redacted before persistence. Viewable by Platform Admins holding the `view_integration_logs` Feature.
_Avoid_: API log, request log, audit log (reserved for future user-action auditing)

## Relationships

- A **Merchant** has one or more **Branches**
- An **Employee** belongs to exactly one **Branch**
- A **Branch** belongs to exactly one **Merchant**
- A **Deal** belongs to one **Merchant** and one **Branch**
- A **Merchant** selects active **Tariffs** from the Finsum global Tariff catalog
- A **Tariff** defines months, **Ustama** rate, and a **Credit Range** (min + max Basket total)
- A **Merchant** is optionally assigned one **Scoring Model**; scoring resolves to the assigned model, else the **Global Model** (exactly one exists at all times). Self-service runs always use the Global Model. Tariffs play no role in scoring
- A **Scoring Model** has one or more **Scoring Model Revisions** (append-only; latest per model is active)
- A **Deal** contains one **Basket** and one **Tariff**
- A **Basket** contains one or more **Products** with quantities; total must fall within the Tariff's **Credit Range** and must not exceed the Client's **Available Balance**
- A **Product** belongs to exactly one **Category**; a **Category** is owned by a **Merchant**
- A **Client** has one **Platform Credit Limit** and an **Available Balance** derived from it
- A **Deal** produces exactly one **Contract**
- A **Contract** produces exactly one **Buyout** obligation toward the Merchant
- A **Deal** carries one **Score** result (stored in `client_scorings`) — set during the Tariff step
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
- The platform has at most one **Organization** (singleton); its requisites print on every **Contract**
- A **Merchant** has at most one **Merchant Bank Account** (MFO + Account Number + bank name stored as columns on the `merchants` row)
- A **Merchant** optionally belongs to one **Region** or **District** (`region_id` nullable FK)
- A **Branch** optionally belongs to one **Region** or **District** (`region_id` nullable FK)
- A **District** belongs to exactly one **Region** (`upper_id` FK); a **Region** has no parent
- An **MFO** resolves to a bank name via the **CBU Bank Registry** at edit time; the resolved name is stored on the `merchants` row

## Auth identity tables

Three separate tables back the three auth flows:

| Table | Actor | Credential |
|---|---|---|
| `admin_users` | Platform Admin | Email + password |
| `merchant_users` | Employee | Email + password |
| `users` | Client | Phone + OTP (registration adds PINFL + MyID) |

`users` is an intentional divergence from the domain term "Client" — the table name was chosen for simplicity. The domain term "Client" remains correct everywhere else (code, API, UI).

## Flagged ambiguities

- "Soft skip" appeared in the Card Score definition — resolved: **Card Score is required**. The Wizard blocks at the Card step until PlumGate scoring returns a result. There is no skip path.

- "Договор", "Сделка", and "Контракт" all appeared in the UI — resolved: **Договор = Deal** (the financing record), **Сделка** is a synonym for Deal used in tab labels only, **Контракт = Contract** (the generated legal document). Never use "Contract" for the Deal itself.
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
| `0003-frontend-stack-ui.md` | Turborepo monorepo, Vue 3 + PrimeVue, ClickUp dual theme, responsive 450px minimum, SSE wizard progress, lazy tab queries |
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
| `0019-merchant-bank-account.md` | MFO + account number + bank name on `merchants`; CBU bank list fetched backend-side, cached on-demand in `bank_mfo_cache`; bank name denormalized at save time |
| `0020-scoring-model-v2-structure.md` | v2 model: StopFactors (hard reject) + ScoringParams + LimitCoefficient; standardized From/To bands; half-open [From,To) semantics; discriminated union engine return type |
| `0021-global-scoring-model.md` | (superseded in part by 0023) `tariffs.scoring_model_id` dropped; `model_revision_id` stamped per scoring run; latest revision is active |
| `0022-scoring-engine-sole-authority.md` | Engine wired into both runtime flows via one server-side orchestrator; Card Score audit-only; Base Limit constant in revision; 0.8 cap accepted until ИНПС/ГНК; decision vocabulary `approved`/`partial`/`denied`/`rejected`; client-supplied scoring POST deleted; latest run wins |
| `0023-per-merchant-scoring-model.md` | `scoring_models` parent entity; Merchant optionally assigned a model (never a revision); exactly one Global Model (atomic switch, no delete); resolution `merchant.model ?? global` → latest revision; one limit per Client, last run wins |

## Example dialogue

> **Agent:** "The Client wants two items — a TV and a washing machine."
> **Domain expert:** "Add both as separate **Products** to the **Basket**. As long as the total tan narxi + Ustama doesn't exceed the **Tariff's Credit Range** max and stays within the Client's **Available Balance**, the Deal can proceed."
> **Agent:** "What if they want 3 months instead of 12?"
> **Domain expert:** "That's a different **Tariff** — the Sales Agent selects the Tariff in the Tarif step. Only Tariffs whose Credit Range max fits within the Client's Available Balance are shown."
