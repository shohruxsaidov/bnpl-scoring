# ADR 0020 — Scoring Model v2 Structure

**Status**: Accepted  
**Date**: 2026-06-09

## Context

The original scoring model (`finsuminpsgnk.json`, v1.0) had a single flat object under `FinsumInpsGnkScoringModelParams` with three structural problems:

1. **Heterogeneous band keys** — each range parameter used its own key names (`IncomeFrom`/`IncomeTo`, `ExperienceFrom`/`ExperienceTo`). The engine sniffed keys at runtime using suffix matching (`endsWith('from')`), making it fragile and untyped.
2. **Stop factors mixed into scoring** — `Juridical` and `DeCommissioned` were scored `EnumCriterion` entries, contributing a weighted value to the total score rather than causing outright rejection.
3. **Closed interval boundary bug** — the engine used `value >= From && value <= To`, causing ambiguity when adjacent bands shared an endpoint.

The new format (`finsum_scoring_model.refactored.json`, v2.0.0) resolves all three and adds `Metadata` and explicit parameter typing.

## Decision

### 1. Four-section model structure

The model is stored in `scoringModelRevisions.params` (JSONB) as:
```json
{ "StopFactors": {}, "ScoringParams": {}, "LimitCoefficient": {} }
```
`Metadata.ModelName` → `name` column, `Metadata.ModelVersion` → `version` column. `Metadata` is not persisted beyond those two columns.

### 2. Stop factors as hard rejections

`StopFactors` are checked before scoring. If any factor with `Reject: true` matches, `computeScoringModel()` returns a discriminated union rejection:
```typescript
{ rejected: true; stopFactor: string; name: string }
```
rather than contributing a negative score. The `rejected: false` branch returns the normal `{ totalScore, coefficient, breakdown }`.

### 3. Standardized `From`/`To` band keys

All range bands use `From` and `To` (not param-specific names). `To: null` means unbounded (match everything above `From`).

### 4. Half-open `[From, To)` boundary semantics

`matchRange` uses `value >= From && (To === null || value < To)`. Adjacent bands share an endpoint without ambiguity.

### 5. Explicit `NotApplicable` for liability parameters

`CoBorrowerLiability`, `GuarantorLiability`, `PledgerLiability` declare a `NotApplicable: { Score }` property. Engine input `null` (not applicable) uses this score; `undefined` (unknown / skip) contributes 0.

### 6. `CreditHistoryContracts` replaces `OverduePrincipalDays`

Pure rename — same ranges and semantics. Engine input renamed from `overduePrincipalContracts` to `creditHistoryContracts`.

### 7. Old data cleared

All existing `scoringModelRevisions` rows and `tariffs` rows were cleared. No dual-format support in the engine. The v2 engine only understands the new format.

## Consequences

- The engine's `computeScoringModel()` return type is a discriminated union — all callers must handle both `rejected` branches.
- `saveModel()` input type changes: `params` is now `{ StopFactors, ScoringParams, LimitCoefficient }`.
- The seed script targets the new JSON file and extracts `name`/`version` from `Metadata`.
- Admin portal types must be updated to reflect the new `params` shape (UI restructuring is deferred).
