import { eq, inArray } from 'drizzle-orm';
import { db } from '@db';
import {
  deals,
  dealItems,
  dealPaymentSchedules,
  dealSessions,
  buyouts,
} from '../../../../deals/schema';
import { calcTotalPayable, splitInstallments } from '../../../../deals/installments';
import { isActiveDealConflict, loadBlockingDeal } from '../../../../deals/blocking';
import { products, users } from '@db/schema';
import { userCreditLimits } from '@db/user-credit-limits';
import { katm077Reports } from '@db/katm-077-reports';
import type { CreateDealInput } from './create-deal.command';
import { calcBasketAmount, computeTermsHash } from '../../../../deals/signing/terms';
import {
  isSigningProofFresh,
  type DealSessionRow,
  type SessionStepData,
} from '../../../deal-sessions/types';
import { onCreatedDealHandler } from '../../events/on-created-deal/on-created-deal.handler';

function coded(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/**
 * Build the Deal FROM the Deal Session (ADR-0024). The session's snapshots are
 * authoritative: basket prices, tariff params, payment day, contract language
 * and scoring all come from step_data written server-side during the run —
 * the request body carries nothing but the session id and the signing token.
 */
export async function createDealFromSession(session: DealSessionRow) {
  const data = (session.stepData ?? {}) as SessionStepData;
  const { client, tariff, products: productsStep, payment, verification, scoring, signing } = data;

  let katmReport: typeof katm077Reports.$inferSelect | null = null;
  if (session.katmClaimId) {
    const [r] = await db
      .select()
      .from(katm077Reports)
      .where(eq(katm077Reports.claimId, session.katmClaimId))
      .limit(1);
    if (r?.demandId != null) katmReport = r;
  }

  // Deal creation requires every step saved; the invalidation rule (a redone
  // step clears everything after it) guarantees верификация is the latest.
  if (!client || !tariff || !productsStep?.lines?.length || !payment || !verification) {
    throw coded('session_incomplete');
  }
  if (!scoring) throw coded('scoring_missing');
  if (scoring.decision === 'declined') throw coded('scoring_declined');

  // One Active Deal — the client cannot already be carrying one. Every earlier
  // gate (the reuse lookup, the scoring pipeline's stage 0, the signing guard)
  // is a read taken at some point in the past; this is the read taken last, and
  // deals_user_active_idx catches the two merchants who both pass even this one.
  if (await loadBlockingDeal(Number(client.userId))) throw coded('active_deal_exists');

  // The signature. MyID proves the client was at the counter; the OTP is their
  // акцепт of these exact terms, given last. Both are server stamps (stepData is
  // never client-written for `signing`), both must be fresh, and both must be
  // about THIS client — a stamp left by a previously-selected client is dropped
  // at save-step, but the PINFL check is the belt to that braces.
  if (!signing || !isSigningProofFresh(signing.myidVerifiedAt)) throw coded('myid_not_verified');
  if (!isSigningProofFresh(signing.otpVerifiedAt)) throw coded('otp_not_verified');

  const [clientRow] = await db
    .select({ pinfl: users.pinfl })
    .from(users)
    .where(eq(users.id, Number(client.userId)))
    .limit(1);
  if (!clientRow || clientRow.pinfl !== signing.pinfl) throw coded('pinfl_mismatch');

  // …and WHAT they consented to. The two stamps above bind a person and a moment;
  // this binds a price. saveStep drops the signature whenever a step moves, so a
  // wizard that walks Back can't reach here — but an API caller that never touched
  // saveStep still could, and the client who signed on their own phone put it back
  // in their pocket and is not watching the Agent's screen. Recomputed from the
  // session's own snapshots, never taken from the request.
  const termsHash = computeTermsHash(data);
  if (!termsHash || !signing.termsHash || termsHash !== signing.termsHash) {
    throw coded('terms_changed');
  }

  // Products must still exist and be active — stale session fails hard and the
  // Agent redoes the Products step (ADR-0024)
  const productIds = productsStep.lines.map((l) => Number(l.productId));
  const productRows = await db
    .select({ id: products.id, active: products.active, vatPercent: products.vatPercent })
    .from(products)
    .where(inArray(products.id, productIds));
  const alive = new Set(productRows.filter((p) => p.active).map((p) => p.id.toString()));
  // Snapshotted onto deal_items so a fiscal receipt issued months later states
  // the rate that applied to the sale, not the Product's current one.
  const vatByProduct = new Map(productRows.map((p) => [p.id, p.vatPercent ?? 12]));
  for (const line of productsStep.lines) {
    if (!alive.has(line.productId)) throw coded('product_not_found');
  }

  // Amounts from the session's price snapshots — the signed contract equals
  // what the Client OTP-consented to, even if prices changed since. Summed by the
  // same function the terms digest uses, so the money in the Deal and the money in
  // the hash cannot drift apart.
  const amount = calcBasketAmount(productsStep.lines);
  const basket = productsStep.lines.map((line) => ({
    productId: Number(line.productId),
    productName: line.productName,
    price: line.price,
    mxikCode: line.mxikCode,
    packageCode: line.packageCode,
    packageName: line.packageName,
    vatPercent: vatByProduct.get(Number(line.productId)) ?? 12,
    quantity: line.quantity,
    labels: line.labels ?? [],
  }));

  const minAmount = tariff.minAmount != null ? Number(tariff.minAmount) : null;
  const maxAmount = tariff.maxAmount != null ? Number(tariff.maxAmount) : null;
  if (minAmount != null && amount < minAmount) throw coded('amount_below_tariff_min');
  if (maxAmount != null && amount > maxAmount) throw coded('amount_above_tariff_max');

  const totalPayable = calcTotalPayable(amount, tariff.markupPercent);

  // Prepayment amount stamped by POST /prepayment (ADR-0026). Null means no prepayment.
  const prepaymentAmount = data.prepayment ? Number(Math.round(data.prepayment.amount)) : null;

  const payload = await createDeal({
    merchantId: session.merchantId,
    branchId: session.branchId,
    agentId: session.agentId,
    userId: Number(client.userId),
    tariffId: Number(tariff.tariffId),
    dealSessionId: session.id,
    basket,
    paymentDay: payment.paymentDay,
    amount,
    totalPayable,
    termMonths: tariff.termMonths,
    markupPercent: tariff.markupPercent,
    scoreSum: scoring.scoreSum,
    scoringDecision: scoring.decision,
    coefficient: scoring.coefficient,
    platformCreditLimit: Number(Math.round(scoring.platformCreditLimit)),
    criteriaScores: scoring.criteriaScores,
    scoringId:
      scoring.scoringId && /^\d+$/.test(scoring.scoringId) ? Number(scoring.scoringId) : null,
    lang: verification.lang,
    consentId: katmReport?.consentId ?? null,
    consentDate: null,
    demandId: katmReport?.demandId ?? null,
    infoscoreRaw: katmReport?.raw ?? null,
    prepaymentAmount,
  });
  await onCreatedDealHandler({
    userId: +client.userId,
    dealId: payload.id,
  });
  return payload;
}

export async function createDeal(input: CreateDealInput) {
  try {
    return await db.transaction(async (tx) => {
      const [deal] = await tx
        .insert(deals)
        .values({
          merchantId: input.merchantId,
          branchId: input.branchId,
          agentId: input.agentId,
          userId: input.userId,
          tariffId: input.tariffId,
          dealSessionId: input.dealSessionId,
          consentId: input.consentId ?? null,
          consentDate: input.consentDate ?? null,
          demandId: input.demandId ?? null,
          infoscoreRaw: input.infoscoreRaw ?? null,
          paymentDay: input.paymentDay,
          amount: input.amount,
          totalPayable: input.totalPayable,
          prepaymentAmount: input.prepaymentAmount ?? null,
          termMonths: input.termMonths,
          scoreSum: input.scoreSum?.toString() ?? null,
          scoringDecision: input.scoringDecision ?? null,
          lang: input.lang,
          status: 'active',
        })
        .returning();

      if (!deal) throw new Error('deal_insert_failed');

      if (input.basket.length > 0) {
        await tx.insert(dealItems).values(
          input.basket.map((item) => ({
            dealId: deal.id,
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            mxikCode: item.mxikCode,
            packageCode: item.packageCode,
            packageName: item.packageName,
            vatPercent: item.vatPercent,
            quantity: item.quantity,
            labels: item.labels ?? [],
          })),
        );
      }

      // Installments run on the credit portion only; the prepayment covers the gap upfront
      const creditPortion = input.prepaymentAmount
        ? input.totalPayable - input.prepaymentAmount
        : input.totalPayable;
      const installments = splitInstallments(creditPortion, input.termMonths);

      const now = new Date();
      const scheduleRows = installments.map((amount, i) => {
        const due = new Date(now.getFullYear(), now.getMonth() + i + 1, input.paymentDay);
        return {
          dealId: deal.id,
          index: i + 1,
          dueDate: due.toISOString().slice(0, 10),
          amount: Number(amount),
          paid: false,
        };
      });

      await tx.insert(dealPaymentSchedules).values(scheduleRows);

      // Scoring history snapshot removed — to be rebuilt from scratch. The deal
      // keeps its own denormalized scoreSum/scoringDecision set above.

      await tx.insert(buyouts).values({
        dealId: deal.id,
        merchantId: input.merchantId,
        branchId: input.branchId,
        amount: input.amount,
      });

      // Close the Wizard run atomically with the Deal it produced
      if (input.dealSessionId) {
        await tx
          .update(dealSessions)
          .set({ status: 'completed', updatedAt: now })
          .where(eq(dealSessions.id, input.dealSessionId));
      }

      // The limit is a one-shot ticket and this deal just spent it — whatever the
      // deal was worth. It does not decrement and it is not handed back when the
      // deal closes: the client re-scores, because by then their obligations have
      // changed and the seven-day TTL had long since lapsed anyway. A no-op for a
      // client scored at the counter, who never had a row of their own.
      await tx.delete(userCreditLimits).where(eq(userCreditLimits.userId, input.userId));

      return deal;
    });
  } catch (err) {
    // Lost the race to deals_user_active_idx — another merchant committed the
    // client's one deal while this transaction was in flight. Same answer as the
    // guard above, just arrived at the hard way.
    if (isActiveDealConflict(err)) throw coded('active_deal_exists');
    throw err;
  }
}
