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
import { products, users } from '@db/schema';
import { katm077Reports } from '@db/katm-077-reports';
import type { CreateDealInput } from './create-deal.command';
import {
  isSigningProofFresh,
  type DealSessionRow,
  type SessionStepData,
} from '../../../deal-sessions/types';

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

  // Products must still exist and be active — stale session fails hard and the
  // Agent redoes the Products step (ADR-0024)
  const productIds = productsStep.lines.map((l) => Number(l.productId));
  const productRows = await db
    .select({ id: products.id, active: products.active })
    .from(products)
    .where(inArray(products.id, productIds));
  const alive = new Set(productRows.filter((p) => p.active).map((p) => p.id.toString()));
  for (const line of productsStep.lines) {
    if (!alive.has(line.productId)) throw coded('product_not_found');
  }

  // Amounts from the session's price snapshots — the signed contract equals
  // what the Client OTP-consented to, even if prices changed since
  let amount = Number(0);
  const basket = productsStep.lines.map((line) => {
    amount += Number(Math.round(parseFloat(line.price) * 100)) * Number(line.quantity);
    return {
      productId: Number(line.productId),
      productName: line.productName,
      price: line.price,
      mxikCode: line.mxikCode,
      packageCode: line.packageCode,
      packageName: line.packageName,
      quantity: line.quantity,
      labels: line.labels ?? [],
    };
  });

  const minAmount = tariff.minAmount != null ? Number(tariff.minAmount) : null;
  const maxAmount = tariff.maxAmount != null ? Number(tariff.maxAmount) : null;
  if (minAmount != null && amount < minAmount) throw coded('amount_below_tariff_min');
  if (maxAmount != null && amount > maxAmount) throw coded('amount_above_tariff_max');

  const totalPayable = calcTotalPayable(amount, tariff.markupPercent);

  // Prepayment amount stamped by POST /prepayment (ADR-0026). Null means no prepayment.
  const prepaymentAmount = data.prepayment
    ? Number(Math.round(data.prepayment.amount))
    : null;

  return createDeal({
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
    scoringId: scoring.scoringId && /^\d+$/.test(scoring.scoringId) ? Number(scoring.scoringId) : null,
    lang: verification.lang,
    consentId: katmReport?.consentId ?? null,
    consentDate: null,
    demandId: katmReport?.demandId ?? null,
    infoscoreRaw: katmReport?.raw ?? null,
    prepaymentAmount,
  });
}

export async function createDeal(input: CreateDealInput) {
  return db.transaction(async (tx) => {
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

    return deal;
  });
}
