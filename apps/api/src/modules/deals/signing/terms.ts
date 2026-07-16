import { createHash } from 'node:crypto';
import { calcTotalPayable, splitInstallments } from '../installments';
import type { SessionStepData } from '../../merchant/deal-sessions/types';

// ---------------------------------------------------------------------------
// Deal terms — the economic content of a Wizard run, and the digest the client's
// акцепт binds to.
//
// The OTP proves a person consented. It does not, on its own, say WHAT they
// consented to: the signing stamp records a PINFL and a moment, and an Agent who
// walks back to the Products step after the client has signed leaves both intact.
// In the counter flow the client is watching the Agent's screen, which is the
// only thing that ever made that safe. Remote signing takes that screen away, so
// the акцепт has to carry the terms with it: sign-verify stamps this digest,
// createDealFromSession recomputes it, and a mismatch is `terms_changed`.
//
// Hashed inputs are the economic ones ONLY — what the client owes, for what, over
// how long, plus the language of the paper they'll be handed. The payment SCHEDULE
// is derived (its due dates depend on the month the deal is created in), so it is
// rendered for the client but never hashed.
// ---------------------------------------------------------------------------

/** A basket line's contribution, in som. Prices are stored as decimal som strings. */
export function lineAmount(price: string, quantity: number): number {
  return parseFloat(price) * quantity;
}

/** Basket total in som (2-decimal) — the principal, before markup. */
export function calcBasketAmount(lines: Array<{ price: string; quantity: number }>): number {
  const sum = lines.reduce((acc, l) => acc + lineAmount(l.price, l.quantity), 0);
  return Math.round(sum * 100) / 100;
}

export interface DealTerms {
  tariffId: string;
  tariffName: string;
  termMonths: number;
  markupPercent: number;
  paymentDay: number;
  lang: 'ru' | 'uz';
  /** Basket total, som. */
  amount: number;
  /** amount × (1 + markup), som. */
  totalPayable: number;
  /** Paid upfront (ADR-0026); 0 when there was no prepayment. */
  prepaymentAmount: number;
  /** What the installments actually run on. */
  creditPortion: number;
  lines: Array<{
    productId: string;
    productName: string;
    /** Marked-up line total, som — what the client sees and consents to. */
    total: number;
    price: string;
    quantity: number;
  }>;
}

/**
 * The economic terms of a run, or null when a step it depends on is unsaved.
 * Every number here is derived from the session's own snapshots — never from a
 * request body — so this is the same view the Agent's screen, the client's phone
 * and createDealFromSession all compute independently and must agree on.
 */
export function buildDealTerms(data: SessionStepData): DealTerms | null {
  const { tariff, products, payment, verification } = data;
  if (!tariff || !products?.lines?.length || !payment) return null;

  const amount = calcBasketAmount(products.lines);
  const totalPayable = calcTotalPayable(amount, tariff.markupPercent);
  const prepaymentAmount = data.prepayment ? Math.round(data.prepayment.amount) : 0;

  return {
    tariffId: tariff.tariffId,
    tariffName: tariff.name,
    termMonths: tariff.termMonths,
    markupPercent: tariff.markupPercent,
    paymentDay: payment.paymentDay,
    // The language is only chosen at the верификация step. Until then the run has
    // no contract language, and 'ru' is the same default the column carries.
    lang: verification?.lang ?? 'ru',
    amount,
    totalPayable,
    prepaymentAmount,
    creditPortion: totalPayable - prepaymentAmount,
    lines: products.lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      total: Math.round(lineAmount(l.price, l.quantity) * (1 + tariff.markupPercent / 100) * 100) / 100,
      price: l.price,
      quantity: l.quantity,
    })),
  };
}

/**
 * Canonical digest of the terms. Field ORDER is the contract here — JSON.stringify
 * over a hand-built array, not over the DealTerms object, so that reordering the
 * interface (or adding a display-only field to it) can never silently change the
 * hash of terms that did not change. Basket lines are sorted, since two runs with
 * the same basket in a different order are the same deal.
 */
function digestInput(t: DealTerms): unknown[] {
  const lines = t.lines
    .map((l) => [l.productId, l.price, l.quantity])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return [
    'deal-terms.v1',
    t.tariffId,
    t.termMonths,
    t.markupPercent,
    t.paymentDay,
    t.lang,
    t.amount,
    t.totalPayable,
    t.prepaymentAmount,
    lines,
  ];
}

export function hashDealTerms(terms: DealTerms): string {
  return createHash('sha256').update(JSON.stringify(digestInput(terms))).digest('hex');
}

/** The digest of a session's current terms, or null when they aren't complete yet. */
export function computeTermsHash(data: SessionStepData): string | null {
  const terms = buildDealTerms(data);
  return terms ? hashDealTerms(terms) : null;
}

export interface ScheduleRow {
  index: number;
  dueDate: string;
  amount: number;
}

/**
 * The installment plan as it would be written today. Derived, never hashed: the
 * due dates hang off the current month, so a run that straddles midnight on the
 * 1st would otherwise "change terms" while sitting untouched on the screen.
 */
export function buildSchedulePreview(terms: DealTerms, now: Date = new Date()): ScheduleRow[] {
  return splitInstallments(terms.creditPortion, terms.termMonths).map((amount, i) => {
    const due = new Date(now.getFullYear(), now.getMonth() + i + 1, terms.paymentDay);
    return {
      index: i + 1,
      dueDate: due.toISOString().slice(0, 10),
      amount: Number(amount),
    };
  });
}
