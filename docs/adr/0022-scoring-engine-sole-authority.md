# ADR 0022 — Scoring Engine as Sole Credit Authority

**Status**: Accepted
**Date**: 2026-06-10

## Context

The v2 scoring engine (`computeScoringModel`) existed but was wired only into admin test endpoints. Production credit decisions were mocked in two places: the Wizard computed the coefficient *in the frontend* with hardcoded thresholds (`score >= 700 ? 1.0 : score >= 600 ? 0.8 : 0`) and POSTed client-supplied numbers to `POST /merchant/scoring-history`, which stored them blindly; the self-service flow used the same hardcoded table server-side. Both flows used PlumGate's card score as the Score and PlumGate's `limit` as the Platform Credit Limit. ADR-0021 explicitly deferred the engine integration ("the column stays null until the engine integration lands").

Two contradictions surfaced during design: the model (`finsuminpsgnk.json`) has **no card-score parameter**, despite CONTEXT.md claiming Card Score "contributes weighted criteria"; and the model is built on ИНПС/ГНК income data for which **no integration exists**.

## Decision

1. **One server-side orchestrator in `modules/scoring`, used by both flows** (Wizard and self-service): KATM raw payload + Client record → `ScoringInputs` → active Scoring Model Revision → `computeScoringModel` → Platform Credit Limit = Limit Coefficient × **Base Limit**. The orchestrator persists the `scoring_histories` row itself, stamping `model_revision_id` (fulfilling ADR-0021) and the full per-parameter breakdown (including `skipped` flags) in `criteria_scores`, alongside an audit block (PlumGate card score + vendor decision, KATM summary).
2. **Card Score is audit-only.** Card registration remains required (the card is the payment instrument) and the PlumGate SCORING call still runs — providing a shadow-comparison dataset — but its result never gates or influences anything. A PlumGate `declined` stops nothing.
3. **Base Limit** is a new top-level constant in the Scoring Model Revision. A fixed platform-wide amount for all Clients until income-derived limits become possible.
4. **Unavailable parameters are skipped, visibly.** `IncomeSum`, `WorkExperience` (no ИНПС/ГНК integration) and `PassportData` (прописка never captured) are passed as `undefined`; the engine skips them and scoring-history views surface them as warnings. **Accepted consequence: the maximum reachable Score is 700, below the 750 needed for coefficient 1.0 — no Client can receive more than 0.8 × Base Limit until income data lands.** This is deliberate conservatism, not a bug; Finsum sets Base Limit with the cap in mind.
5. **All KATM-derivable parameters are parsed now** from the already-stored 077 raw payload: overdue buckets from per-contract `overdue_principal` arrays, the three role liabilities from contingent-liability role codes, `Mortgage` from `credit_type`, Stop Factors from `delays_in_court_qty` / `delays_decommissioned_qty`, `CreditHistoryContracts` as the model's three-state encoding (0 = no history, 1 = clean, 2 = any overdue **ever**, open or closed). Skipping these is not an option: without them the maximum Score is 350 and every Client would be denied.
6. **Decision vocabulary unified with Expected Outcome**: `approved` (1.0) / `partial` (0.8) / `denied` (0) / `rejected` (Stop Factor fired). `manual_review` is retired; legacy rows are read-tolerated, never rewritten. `rejected` runs store `scoreSum = null`, `coefficient = null`, and the fired Stop Factor in the breakdown.
7. **`POST /merchant/scoring-history` is deleted.** Client-supplied credit decisions were a security hole (any Agent with devtools could write their own limit). The Wizard's `/merchant/cards/score` endpoint triggers the orchestrator and returns the engine's result.
8. **Latest completed run is always authoritative**, including negative outcomes: a `denied`/`rejected` re-score upserts the limit to 0, overwriting a previous positive limit. Active Deals are untouched; Available Balance floors at 0.
9. **If the KATM raw payload is missing or unparseable, the scoring run fails loudly** — consistent with the KATM hard-block policy (ADR-0008, ADR-0015). Scoring with everything skipped would silently deny everyone.
10. **Integration mocks (`KATM_MOCK`, `PLUM_MOCK`) stay** — they mock vendors, not credit logic. The KATM mock's `raw` fixture must be extended to exercise the new parser.

## Alternatives considered

- **Card score as the limit base** (engine decides coefficient, PlumGate limit as base) — rejected: quietly keeps the card vendor inside the credit decision.
- **CardScore as a new model parameter** — rejected: edits the model contract and every Scoring Test Case for a signal the risk model wasn't designed around.
- **Recalibrate the 750 threshold so 1.0 is reachable without income data** — rejected: a credit-policy change to a designed model that would have to be deliberately reverted later; the 0.8 cap is acceptable and self-resolving.
- **Keep the scoring-history POST but recompute server-side, ignoring the payload** — rejected: an endpoint that lies about what it does.
- **Only upsert limits on positive outcomes** — rejected: a known-bad Client would keep a stale positive limit visible in the Client portal.

## Consequences

- The Wizard frontend (`step-karta.vue`) loses its coefficient math and decision logic; it displays server results only. `ScoreDecision`, status badges, and `availableForTarif` move to the four-value vocabulary (proceed on `approved`/`partial`).
- Scoring Test Cases should include "no income data" profiles, since that is production reality until ИНПС/ГНК integration.
- The postponed admin-portal scoring UI restructure gains two concrete requirements: a Base Limit field in the model editor and Skipped-Parameter warnings in history views.
- When the income integration lands, the work is: populate three inputs + revisit the Base Limit formula (income-derived). The orchestrator and vocabulary don't change.
