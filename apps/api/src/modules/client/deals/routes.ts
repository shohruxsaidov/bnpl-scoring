import { and, asc, desc, eq, ne } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { deals, dealPaymentSchedules } from '../../deals/db/schema'
import { merchants, tariffs } from '../../id/db/schema'

type ClientJwt = { sub: string; type: 'client' }

function clientId(request: { user: unknown }): bigint {
  return BigInt((request.user as ClientJwt).sub)
}

export default async function clientDealRoutes(app: FastifyInstance) {
  /* ── GET / — list ──────────────────────────────────────────────────────── */
  app.get('/', { preHandler: app.verifyClientJwt }, async (request) => {
    const cId = clientId(request)

    const rows = await app.db
      .select({ deal: deals, merchant: merchants, tariff: tariffs })
      .from(deals)
      .leftJoin(merchants, eq(deals.merchantId, merchants.id))
      .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
      .where(and(eq(deals.clientId, cId), ne(deals.status, 'draft')))
      .orderBy(desc(deals.createdAt))

    const dealList = await Promise.all(
      rows.map(async (r) => {
        const schedule = await app.db
          .select()
          .from(dealPaymentSchedules)
          .where(eq(dealPaymentSchedules.dealId, r.deal.id))
          .orderBy(asc(dealPaymentSchedules.index))

        const paymentsMade = schedule.filter((s) => s.paid).length
        const paymentsTotal = schedule.length
        const unpaid = schedule.filter((s) => !s.paid)
        const nextPaymentDate = unpaid[0]?.dueDate ?? null
        const nextPaymentAmount = unpaid[0] ? Number(unpaid[0].amount) : 0

        return {
          id: r.deal.id,
          dealNumber: Number(r.deal.dealNumber),
          status: r.deal.status,
          merchant: r.merchant?.name ?? '',
          amount: Number(r.deal.amount ?? 0),
          totalPayable: Number(r.deal.totalPayable ?? 0),
          termMonths: r.deal.termMonths ?? 0,
          markupPercent: r.tariff ? parseFloat(r.tariff.markupPercent) : 0,
          tariffLabel: r.tariff?.name ?? '',
          paymentsMade,
          paymentsTotal,
          nextPaymentDate,
          nextPaymentAmount,
          createdAt: r.deal.createdAt.toISOString(),
        }
      }),
    )

    return { deals: dealList }
  })

  /* ── GET /:id — detail with schedule ──────────────────────────────────── */
  app.get('/:id', { preHandler: app.verifyClientJwt }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const cId = clientId(request)

    const rows = await app.db
      .select({ deal: deals, merchant: merchants, tariff: tariffs })
      .from(deals)
      .leftJoin(merchants, eq(deals.merchantId, merchants.id))
      .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
      .where(and(eq(deals.id, id), eq(deals.clientId, cId), ne(deals.status, 'draft')))
      .limit(1)

    const row = rows[0]
    if (!row) return reply.code(404).send({ code: 'deal_not_found' })

    const schedule = await app.db
      .select()
      .from(dealPaymentSchedules)
      .where(eq(dealPaymentSchedules.dealId, id))
      .orderBy(asc(dealPaymentSchedules.index))

    const paymentsMade = schedule.filter((s) => s.paid).length
    const paymentsTotal = schedule.length
    const unpaid = schedule.filter((s) => !s.paid)
    const nextPaymentDate = unpaid[0]?.dueDate ?? null
    const nextPaymentAmount = unpaid[0] ? Number(unpaid[0].amount) : 0

    return {
      deal: {
        id: row.deal.id,
        dealNumber: Number(row.deal.dealNumber),
        status: row.deal.status,
        merchant: row.merchant?.name ?? '',
        amount: Number(row.deal.amount ?? 0),
        totalPayable: Number(row.deal.totalPayable ?? 0),
        termMonths: row.deal.termMonths ?? 0,
        markupPercent: row.tariff ? parseFloat(row.tariff.markupPercent) : 0,
        tariffLabel: row.tariff?.name ?? '',
        paymentsMade,
        paymentsTotal,
        nextPaymentDate,
        nextPaymentAmount,
        createdAt: row.deal.createdAt.toISOString(),
        schedule: schedule.map((s) => ({
          no: s.index,
          dueDate: s.dueDate,
          amount: Number(s.amount),
          paidAmount: Number(s.paidAmount ?? 0n),
          paid: s.paid,
          paidAt: s.paidAt?.toISOString() ?? null,
        })),
      },
    }
  })
}
