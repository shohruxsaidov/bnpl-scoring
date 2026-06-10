# ADR 0021 — Global Scoring Model Only (No Per-Tariff Pinning)

**Status**: Accepted
**Date**: 2026-06-10

## Context

Tariffs carried an optional `scoring_model_id` reference to a specific Scoring Model Revision, documented as "the revision whose parameters must be used when computing a Client's Score for Deals under that Tariff" (set at creation, immutable, null = fall back to the active revision).

In practice the reference was never consumed: the scoring engine resolved the model exclusively via `getActiveModel()` (latest revision by id) in every flow — Wizard and self-service alike. The pin was written at tariff creation, displayed in the admin portal, and ignored at scoring time. ADR 0020's v2 migration also cleared all existing `tariffs` rows, so no production data depends on the column.

## Decision

1. **One global scoring model.** The active Scoring Model Revision (latest by id, append-only) applies to every scoring run platform-wide. Tariffs are purely pricing constructs — name, term, Ustama, Credit Range — with no influence on scoring.
2. **Remove the reference entirely.** Drop `tariffs.scoring_model_id`, remove `scoringModelId` from the tariff API contract (create + list), and remove the model picker/column from the admin portal tariff UI.
3. **Record the revision per scoring run.** Add a nullable `model_revision_id` to `scoring_histories`. This preserves "which model made this decision" traceability that per-tariff pinning nominally provided. Note: the v2 model engine (`computeScoringModel`) is not yet wired into the runtime flows — self-service uses a hardcoded coefficient table and the Wizard endpoint records client-supplied scores — so the column stays null until the engine integration lands, at which point the server stamps it at scoring time. Historical rows stay null.
4. **Keep latest-is-active.** No draft/activate workflow: saving a revision makes it live immediately. Admins are expected to validate candidate models against the Scoring Test Case suite before saving. An explicit activation step can be added later if needed.

## Alternatives considered

- **Make per-tariff pinning actually work** — implement the documented fallback in the engine. Rejected: Finsum operates one risk policy for the whole portfolio; per-tariff models would fragment credit decisions for the same Client across tariffs and complicate the Platform Credit Limit, which is computed once per Client, not per Tariff.
- **Keep the column dormant** — rejected: a dead column that contradicts the domain model invites misuse.

## Consequences

- Saving a Scoring Model Revision instantly changes credit decisions platform-wide; the Scoring Test Run suite is the safety net before saves.
- Audit of past decisions relies on `scoring_histories.model_revision_id` (plus the existing `criteria_scores` breakdown) rather than tariff pins.
- Reintroducing per-tariff (or per-merchant) models later would be a new feature, not a revert.
