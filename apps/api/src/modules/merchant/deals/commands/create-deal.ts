import { eq, inArray } from "drizzle-orm"
import type { Db } from "../../../../db"
import { deals, dealItems, dealPaymentSchedules, dealSessions, dealSessionEvents, scoringHistories, buyouts } from "../../../deals/schema"
import { calcTotalPayable, splitInstallments } from "../../../deals/installments"
import { clients, products } from '@db/schema'
import type { DealSessionRow, SessionStepData } from "../../deal-sessions/service"

export interface CreateDealInput {
  merchantId: number
  branchId: number
  agentId: number
  clientId: number
  tariffId: number
  dealSessionId: string | null
  basket: Array<{
    productId: number
    productName: string
    price: string
    mxikCode: string | null
    packageCode: number | null
    packageName: string | null
    quantity: number
  }>
  paymentDay: number
  amount: number
  totalPayable: number
  termMonths: number
  markupPercent: number
  scoreSum: number | null
  scoringDecision: string | null
  coefficient?: number | null
  platformCreditLimit?: number | null
  criteriaScores?: Record<string, unknown> | null
  scoringId?: number | null
  lang: "ru" | "uz"
  // KATM audit trail copied from the Deal Session (ADR-0024)
  consentId?: string | null
  consentDate?: string | null
  demandId?: string | null
  infoscoreRaw?: unknown
  // Avansoviy to'lov — null means no prepayment (ADR-0026)
  prepaymentAmount?: number | null
}

function coded(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code })
}

/**
 * Build the Deal FROM the Deal Session (ADR-0024). The session's snapshots are
 * authoritative: basket prices, tariff params, payment day, contract language
 * and scoring all come from step_data written server-side during the run —
 * the request body carries nothing but the session id and the signing token.
 */
export async function createDealFromSession(db: Db, session: DealSessionRow) {
  const data = (session.stepData ?? {}) as SessionStepData
  const { client, tariff, products: productsStep, payment, verification, scoring, katm } = data

  // Deal creation requires every step saved; the invalidation rule (a redone
  // step clears everything after it) guarantees верификация is the latest.
  if (!client || !tariff || !productsStep?.lines?.length || !payment || !verification) {
    throw coded("session_incomplete")
  }
  if (!scoring) throw coded("scoring_missing")
  if (scoring.decision === "declined") throw coded("scoring_declined")

  // Products must still exist and be active — stale session fails hard and the
  // Agent redoes the Products step (ADR-0024)
  const productIds = productsStep.lines.map((l) => Number(l.productId))
  const productRows = await db
    .select({ id: products.id, active: products.active })
    .from(products)
    .where(inArray(products.id, productIds))
  const alive = new Set(productRows.filter((p) => p.active).map((p) => p.id.toString()))
  for (const line of productsStep.lines) {
    if (!alive.has(line.productId)) throw coded("product_not_found")
  }

  // Amounts from the session's price snapshots — the signed contract equals
  // what the Client OTP-consented to, even if prices changed since
  let amount = Number(0)
  const basket = productsStep.lines.map((line) => {
    amount += Number(Math.round(parseFloat(line.price) * 100)) * Number(line.quantity)
    return {
      productId: Number(line.productId),
      productName: line.productName,
      price: line.price,
      mxikCode: line.mxikCode,
      packageCode: line.packageCode,
      packageName: line.packageName,
      quantity: line.quantity,
    }
  })

  const minAmount = tariff.minAmount != null ? Number(tariff.minAmount) : null
  const maxAmount = tariff.maxAmount != null ? Number(tariff.maxAmount) : null
  if (minAmount != null && amount < minAmount) throw coded("amount_below_tariff_min")
  if (maxAmount != null && amount > maxAmount) throw coded("amount_above_tariff_max")

  const totalPayable = calcTotalPayable(amount, tariff.markupPercent)

  // Prepayment amount stamped by POST /prepayment (ADR-0026). Null means no prepayment.
  const prepaymentAmount = data.prepayment
    ? Number(Math.round(data.prepayment.amount))
    : null

  return createDeal(db, {
    merchantId: session.merchantId,
    branchId: session.branchId,
    agentId: session.agentId,
    clientId: Number(client.clientId),
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
    consentId: katm?.consentId ?? null,
    consentDate: katm?.consentDate ?? null,
    demandId: katm?.demandId ?? null,
    infoscoreRaw: katm?.raw ?? null,
    prepaymentAmount,
  })
}

export async function createDeal(db: Db, input: CreateDealInput) {
  return db.transaction(async (tx) => {
    const [deal] = await tx
      .insert(deals)
      .values({
        merchantId: input.merchantId,
        branchId: input.branchId,
        agentId: input.agentId,
        clientId: input.clientId,
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
        status: "active",
      })
      .returning()

    if (!deal) throw new Error("deal_insert_failed")

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
        })),
      )
    }

    // Installments run on the credit portion only; the prepayment covers the gap upfront
    const creditPortion = input.prepaymentAmount
      ? input.totalPayable - input.prepaymentAmount
      : input.totalPayable
    const installments = splitInstallments(creditPortion, input.termMonths)

    const now = new Date()
    const scheduleRows = installments.map((amount, i) => {
      const due = new Date(now.getFullYear(), now.getMonth() + i + 1, input.paymentDay)
      return {
        dealId: deal.id,
        index: i + 1,
        dueDate: due.toISOString().slice(0, 10),
        amount: Number(amount),
        paid: false,
      }
    })

    await tx.insert(dealPaymentSchedules).values(scheduleRows)

    if (input.scoringDecision != null && input.platformCreditLimit != null && input.scoringId == null) {
      const [clientSnap] = await tx
        .select({
          firstName: clients.firstName,
          lastName: clients.lastName,
          middleName: clients.middleName,
          passportNumber: clients.passportNumber,
          passportSerial: clients.passportSerial,
          pinfl: clients.pinfl,
          phone: clients.phone,
        })
        .from(clients)
        .where(eq(clients.id, input.clientId))
        .limit(1)
      await tx.insert(scoringHistories).values({
        firstName: clientSnap?.firstName ?? null,
        lastName: clientSnap?.lastName ?? null,
        middleName: clientSnap?.middleName ?? null,
        passportNumber: clientSnap?.passportNumber ?? null,
        passportSeries: clientSnap?.passportSerial ?? null,
        pinfl: clientSnap?.pinfl ?? null,
        phoneNumber: clientSnap?.phone ?? null,
        criteriaScores: input.criteriaScores ?? null,
        scoreSum: input.scoreSum?.toString() ?? null,
        coefficient: input.coefficient != null ? input.coefficient.toString() : null,
        decision: input.scoringDecision,
        platformCreditLimit: input.platformCreditLimit,
      })
    }

    await tx.insert(buyouts).values({
      dealId: deal.id,
      merchantId: input.merchantId,
      branchId: input.branchId,
      amount: input.amount,
    })

    // Close the Wizard run atomically with the Deal it produced
    if (input.dealSessionId) {
      await tx
        .update(dealSessions)
        .set({ status: "completed", updatedAt: now })
        .where(eq(dealSessions.id, input.dealSessionId))
      await tx
        .insert(dealSessionEvents)
        .values({ sessionId: input.dealSessionId, step: "completed", payload: { dealId: deal.id } })
    }

    return deal
  })
}
