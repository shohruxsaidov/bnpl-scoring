import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { deals, dealItems, dealPaymentSchedules, scoringHistories, buyouts } from "../../../deals/db/schema"
import { clients, tariffs, products } from "../../../id/db/schema"

export interface CreateDealInput {
  merchantId: bigint
  branchId: bigint
  agentId: bigint
  clientId: bigint
  tariffId: bigint
  basket: Array<{
    productId: bigint
    productName: string
    price: string
    mxikCode: string | null
    packageCode: number | null
    packageName: string | null
    quantity: number
  }>
  paymentDay: number
  amount: bigint
  totalPayable: bigint
  termMonths: number
  markupPercent: number
  scoreSum: number | null
  scoringDecision: string | null
  coefficient?: number | null
  platformCreditLimit?: bigint | null
  criteriaScores?: Record<string, number> | null
  scoringId?: bigint | null
  lang: "ru" | "uz"
}

export interface ResolveAndCreateDealInput {
  merchantId: bigint
  branchId: bigint
  agentId: bigint
  clientId: bigint
  tariffId: bigint
  basket: Array<{ productId: string; quantity: number }>
  paymentDay: number
  scoreSum: number | null
  scoringDecision: string | null
  coefficient?: number | null
  platformCreditLimit?: bigint | null
  criteriaScores?: Record<string, number> | null
  scoringId?: bigint | null
  lang: "ru" | "uz"
}

export async function resolveAndCreateDeal(db: Db, input: ResolveAndCreateDealInput) {
  const [tariff] = await db.select().from(tariffs).where(eq(tariffs.id, input.tariffId)).limit(1)
  if (!tariff) throw Object.assign(new Error("tariff_not_found"), { code: "tariff_not_found" })

  const productIds = input.basket.map((i) => BigInt(i.productId))
  const productRows = await Promise.all(
    productIds.map((id) => db.select().from(products).where(eq(products.id, id)).limit(1)),
  )

  let amount = BigInt(0)
  const resolvedBasket = input.basket.map((item, idx) => {
    const p = productRows[idx]?.[0]
    if (!p) throw Object.assign(new Error(`product_not_found:${item.productId}`), { code: "product_not_found" })
    const itemTotal = BigInt(Math.round(parseFloat(p.price) * 100)) * BigInt(item.quantity)
    amount += itemTotal
    return {
      productId: p.id,
      productName: p.name,
      price: p.price,
      mxikCode: p.mxikCode ?? null,
      packageCode: p.packageCode ?? null,
      packageName: p.packageName ?? null,
      quantity: item.quantity,
    }
  })

  const markupPercent = parseFloat(tariff.markupPercent)
  const totalPayable = BigInt(Math.round(Number(amount) * (1 + markupPercent / 100)))

  return createDeal(db, {
    merchantId: input.merchantId,
    branchId: input.branchId,
    agentId: input.agentId,
    clientId: input.clientId,
    tariffId: input.tariffId,
    basket: resolvedBasket,
    paymentDay: input.paymentDay,
    amount,
    totalPayable,
    termMonths: tariff.termMonths,
    markupPercent,
    scoreSum: input.scoreSum,
    scoringDecision: input.scoringDecision,
    coefficient: input.coefficient ?? null,
    platformCreditLimit: input.platformCreditLimit ?? null,
    criteriaScores: input.criteriaScores ?? null,
    scoringId: input.scoringId ?? null,
    lang: input.lang,
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
        paymentDay: input.paymentDay,
        amount: input.amount,
        totalPayable: input.totalPayable,
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

    const monthlyRaw = Number(input.totalPayable) / input.termMonths
    const monthly = Math.round(monthlyRaw)
    const lastMonthly = Number(input.totalPayable) - monthly * (input.termMonths - 1)

    const now = new Date()
    const scheduleRows = Array.from({ length: input.termMonths }, (_, i) => {
      const due = new Date(now.getFullYear(), now.getMonth() + i + 1, input.paymentDay)
      const amount = i === input.termMonths - 1 ? lastMonthly : monthly
      return {
        dealId: deal.id,
        index: i + 1,
        dueDate: due.toISOString().slice(0, 10),
        amount: BigInt(amount),
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

    return deal
  })
}
