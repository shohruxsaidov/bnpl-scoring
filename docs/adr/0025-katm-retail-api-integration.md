# KATM Retail API integration — consume-only

Status: accepted (2026-06-12). Amends ADR-0024 (claim id) and supersedes the bureau-call shape assumed by the former ADR-0008 (single `infoscore` call, Basic auth).

KATM moved us onto its Retail API (`api.infokredit.uz/katm-api/v1/`, spec v12.4): JSON-body credentials (`security.pLogin/pPassword` + `pCode`/`pHead`), and a multi-step flow instead of one report call. The previous integration only ever ran against our mock (`KATM_MOCK=true`), so this is a clean replacement, not a migration.

**Scope: consume-only.** We implement claim registration (`/claim/registration`), credit report retrieval (`/credit/report` + `/credit/report/status`), and the ban-registry check (`/client/credit/ban/status`). The lender's provider obligations — rejection reporting, contract registration, repayment schedules, repayments — are **deliberately deferred** to a future phase; they remain a known legal obligation, not a forgotten one. Legal-entity and read-back endpoints are out of scope.

## The flow (both Wizard and self-service Scoring Session)

Consent → ban pre-check → claim registration → report request → poll → parse → stamp.

- **Ban pre-check** runs before claim registration; an active ban stops the run immediately so no claim is recorded with the bureau for a client who cannot legally be credited.
- **Report** is InfoScore 077 in JSON (`pReportFormat=1`); `pReportId` is config. The decoded payload is assumed to match the existing parser/scoring-input shape — verifying this against KATM's test environment is a blocking early task.
- **Async reports**: on result `05050` a background job polls `/credit/report/status` every ≥60 s for up to 10–15 minutes (Deal Sessions are resumable, so the Agent can park the run); SSE notifies on arrival. Exhaustion fails the run — the existing "KATM failure hard-blocks the Deal" rule stands.
- KATM-SIR (`clientId` in the response) is stored on the client/user row; future claims and the provider phase reference it.

## Decisions with real alternatives

**Claim id is a shared sequence, not the session UUID.** `pClaimId` is `String(20)`; a UUID is 36 chars. A single Postgres sequence feeds a `katm_claim_id` column on both `deal_sessions` and `scoring_sessions`, assigned at claim registration. This amends ADR-0024's "session UUID is the claim_id" rule. Rejected: truncated/encoded UUIDs (collision risk or still too long).

**Claim amount is a fixed 30 000 000 tiyin (300 000 so'm), end date +12 months (both config).** Claim registration mandates `pCreditAmount`/`pCreditEndDate`, but the bureau pull happens at the Клиент step — before the Tariff (term) or Basket (amount) exist, and `pIsUpdate=1` is locked until KATM certifies our testing. Re-ordering the Wizard is impossible (scoring needs the report before Tariffs can be offered). Rejected: Base-Limit-derived applied amount; Agent-entered requested amount.

**Consent is a persisted, sequence-numbered record — not a paper document.** Created at the Клиент step / self-service consent screen, capturing who, when, which session, and how. Its number is `pAgreementId`, its timestamp `pAgreementDate`. Replaces the previous fabricated random 10-char `consent_id`, which referenced nothing auditable.

**Address, region (dict 016), district (dict 052), and doc type come from MyID, with manual entry as fallback.** These are mandatory on claim registration and were never captured. The MyID extraction is extended (MyID does return them; we dropped them), MyID region identifiers map to KATM 016/052 codes seeded as reference data, and new columns land on `clients`/`users`. Rows missing the fields (all pre-existing clients) get them typed in by the Agent (Wizard) or the user (self-service consent screen) — no forced MyID re-run.

## Consequences

- KATM dictionaries 016/052 become seeded reference data; the existing `regions` table (mvd/cbu codes) does not cover them.
- New config: `KATM_CODE`, `KATM_HEAD`, `KATM_REPORT_ID`, claim amount/term, poll interval/attempts. Beware: the vendor PDF's TEST/PROD base-URL labels are swapped (`testapi.` is test).
- The mock must be rebuilt around the new request/response shapes, including the `05050`/token polling path.
- Capturing registration address removes one blocker for the `PassportData` Skipped Parameter in scoring (still blocked on model wiring, but the data will now exist for new clients).
