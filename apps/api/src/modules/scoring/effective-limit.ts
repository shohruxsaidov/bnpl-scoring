// ---------------------------------------------------------------------------
// Effective limit — what an approved per-month limit is actually worth over a
// term, in whole som.
//
// The model produces a PER-MONTH disposable figure (see compute-limit.ts and
// user_credit_limits.credit_limit). Nothing can be bought with a per-month
// number on its own: the wizard scales it by the tariff's term to get the
// ceiling a basket must fit under, and the client app shows the same scaling as
// a menu of terms. This module is that one scaling rule, so the phone and the
// counter can never quote a different number for the same limit.
//
// WHAT THIS CEILING MEASURES: the marked-up total — what the client will OWE —
// not the price tag of goods they may pick. The wizard's own check is
// `totalWithMarkup <= effectiveLimit` (deal-sessions/index.ts, step-products.vue),
// so under a 20% tariff a 9 000 000 ceiling buys a 7 500 000 basket. Any surface
// that labels this figure as a shopping budget overstates it by the markup.
//
// ADVISORY, NOT ENFORCED: create-deal does not validate a basket against this,
// and did not before the cap existed either. This bounds what the wizard offers
// and what the prepayment gap is computed from — it is not a gate on deal
// creation. Treat it as the number the platform PROMISES, not the number it
// polices.
// ---------------------------------------------------------------------------

/**
 * Hard ceiling on a single deal's credit portion, in whole som, regardless of
 * how large the per-month limit or how long the term. A well-scored applicant on
 * a 24-month tariff can otherwise scale past any figure the business is willing
 * to underwrite in one go.
 */
export const MAX_EFFECTIVE_LIMIT_SOM = 30_000_000;

/**
 * Per-month limit × term, capped. Whole som.
 *
 * Rounds because the per-month figure is nominally whole som but arrives from a
 * varchar column and from a jsonb scoring stamp, neither of which guarantees it.
 * A non-finite or negative input floors to 0 rather than propagating NaN into a
 * credit figure — a limit of "NaN" renders as a broken screen, and 0 is the
 * honest reading of "we do not have a usable limit".
 */
export function effectiveLimitOf(perMonthSom: number, termMonths: number): number {
  const product = Math.round(perMonthSom * termMonths);
  if (!Number.isFinite(product) || product <= 0) return 0;
  return Math.min(product, MAX_EFFECTIVE_LIMIT_SOM);
}
