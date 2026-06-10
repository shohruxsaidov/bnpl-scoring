# ADR 0023 — Per-Merchant Scoring Model Assignment with a Single Global Default

**Status**: Accepted (supersedes ADR-0021 in part)
**Date**: 2026-06-10

## Context

ADR-0021 (accepted earlier the same day) established one global scoring model and noted that reintroducing per-entity models "would be a new feature, not a revert." This is that feature: Finsum now needs the ability to apply different scoring configurations to different Merchants — e.g. a stricter model for a high-risk vertical — while everything else keeps using one default.

Until now there was no "scoring model" entity at all: `scoring_model_revisions` was an append-only list of snapshots of THE single model, with the newest row implicitly live.

## Decision

1. **Introduce a `scoring_models` parent entity.** A Scoring Model is a named family of revisions; `scoring_model_revisions` gains a `scoring_model_id` FK. Within each model, latest-revision-is-active is unchanged (ADR-0021 §4 carries over, scoped per model).
2. **Merchants reference a model, never a revision.** `merchants.scoring_model_id` is a nullable FK to `scoring_models`. Resolution is `merchant.scoring_model_id ?? global model`, then that model's latest revision. Referencing the model (not a revision) avoids the stale-pin problem that killed `tariffs.scoring_model_id` in ADR-0021.
3. **Exactly one Global Model at all times.** A flag on `scoring_models` (enforced by a partial unique index) marks the platform default, used for Merchants with no assignment and for all self-service runs. Marking another model Global atomically unmarks the previous one; the mark cannot be removed without a successor and the Global Model cannot be deleted. Existing revisions are backfilled under a single model marked Global.
4. **Platform Credit Limit stays one number per Client; last scoring run wins.** Each run resolves its model at scoring time and its result overwrites the Client's limit, even when consecutive runs at different Merchants resolve to different models. We accept that the limit can shift between merchants.
5. **No model deletion in v1.** To retire a non-global model, clear/reassign its Merchants (they fall back to the Global Model); the row remains for audit. Only the platform admin assigns models to Merchants.
6. **Scope.** This iteration ships schema, backfill, admin API (model CRUD, mark-global, merchant assignment), and a shared `resolveScoringModel(merchantId?)` helper. Runtime flows do not consume it until the ADR-0022 engine integration lands; admin portal UI arrives with the planned scoring-UI restructure.

## Alternatives considered

- **Merchant pins a specific revision** — rejected: every admin edit strands the pin on a stale snapshot, the exact dead-reference failure ADR-0021 just removed from tariffs.
- **Per-merchant credit limits** — would fix the limit flip-flop but redefines Platform Credit Limit, Available Balance, and cross-merchant exposure as per-merchant concepts; far too large a blast radius for the need.
- **Merchant model as approval gate only** (global model always sets the limit; merchant model can only deny/partial locally) — rejected: two engine runs per scoring with two histories makes decisions harder to explain.

## Consequences

- ADR-0021's "one global scoring model" decision (§1–2) is superseded; its §3 (stamp `model_revision_id` per scoring run) and §4 (latest-is-active, now per model) remain in force. A revision id still fully identifies the model for audit, so `scoring_histories` and `scoring_test_runs` schemas are unchanged, and the global Scoring Test Case suite runs against any model's revision as before.
- A Client's Platform Credit Limit can change merely because they shopped at a Merchant with a different model. Finsum accepts this; the per-run `model_revision_id` stamp explains any surprising shift.
- Until ADR-0022 integration lands, merchant assignment is dormant configuration with no runtime effect.
