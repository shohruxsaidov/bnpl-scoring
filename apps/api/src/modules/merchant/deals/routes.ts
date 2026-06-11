import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { resolveAndCreateDeal } from './commands/create-deal'
import { listDeals } from './queries/list-deals'
import { getDealById } from './queries/get-deal'
import { getContractPdfUrl } from './queries/get-contract-pdf-url'
import { notifyDealCreated, notifyDealDecision } from '../../notifications/service'

type JwtPayload = {
  sub: string
  merchantId: string
  branchId: string
  role: string
}

function payload(request: { user: unknown }) {
  return request.user as JwtPayload
}

function formatDealNumber(n: bigint | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, '0')}` : '—'
}

export default async function merchantDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  /* ── Body schemas ──────────────────────────────────────────────────────── */

  const BasketItemBody = Type.Object({
    productId: Type.String({ minLength: 1 }),
    quantity: Type.Integer({ minimum: 1 }),
  })

  const CreateDealBody = Type.Object({
    clientId: Type.String({ minLength: 1 }),
    tariffId: Type.String({ minLength: 1 }),
    basket: Type.Array(BasketItemBody, { minItems: 1 }),
    paymentDay: Type.Integer({ minimum: 1, maximum: 28 }),
    signingToken: Type.String({ minLength: 1 }),
    scoreSum: Type.Optional(Type.Number()),
    scoringDecision: Type.Optional(Type.String()),
    coefficient: Type.Optional(Type.Number()),
    platformCreditLimit: Type.Optional(Type.Number()),
    criteriaScores: Type.Optional(Type.Record(Type.String(), Type.Number())),
    scoringId: Type.Optional(Type.String()),
    lang: Type.Optional(Type.Union([Type.Literal('ru'), Type.Literal('uz')])),
  })

  const IdParams = Type.Object({ id: Type.String() })

  const ListDealsQuery = Type.Object({
    sortBy: Type.Optional(Type.Union([
      Type.Literal('status'),
      Type.Literal('amount'),
      Type.Literal('createdAt'),
    ])),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  })

  /* ── POST / — create deal ─────────────────────────────────────────────── */

  fastify.post(
    '/',
    {
      schema: { body: CreateDealBody },
      preHandler: [app.verifyMerchantJwt, app.requirePermission('create_deal')],
    },
    async (request, reply) => {
      const p = payload(request)

      let signingPayload: { phone: string; purpose: string }
      try {
        signingPayload = app.jwt.verify<{ phone: string; purpose: string }>(
          request.body.signingToken,
        )
      } catch {
        return reply.code(400).sendError('invalid_signing_token')
      }

      if (signingPayload.purpose !== 'deal_signing') {
        return reply.code(400).sendError('invalid_signing_purpose')
      }

      const {
        basket,
        paymentDay,
        scoreSum,
        scoringDecision,
        coefficient,
        platformCreditLimit,
        criteriaScores,
        scoringId,
        lang,
      } = request.body

      let deal: Awaited<ReturnType<typeof resolveAndCreateDeal>>
      try {
        deal = await resolveAndCreateDeal(db, {
          merchantId: BigInt(p.merchantId),
          branchId: BigInt(p.branchId),
          agentId: BigInt(p.sub),
          clientId: BigInt(request.body.clientId),
          tariffId: BigInt(request.body.tariffId),
          basket,
          paymentDay,
          scoreSum: scoreSum ?? null,
          scoringDecision: scoringDecision ?? null,
          coefficient: coefficient ?? null,
          platformCreditLimit: platformCreditLimit != null ? BigInt(Math.round(platformCreditLimit)) : null,
          criteriaScores: criteriaScores ?? null,
          scoringId: scoringId ? BigInt(scoringId) : null,
          lang: lang ?? 'ru',
        })
      } catch (err: any) {
        if (err.code === 'tariff_not_found') return reply.code(400).sendError('tariff_not_found')
        if (err.code === 'product_not_found') return reply.code(400).sendError('product_not_found')
        if (err.code === 'amount_below_tariff_min') return reply.code(400).sendError('amount_below_tariff_min')
        if (err.code === 'amount_above_tariff_max') return reply.code(400).sendError('amount_above_tariff_max')
        throw err
      }

      notifyDealCreated(db, {
        dealId: deal.id,
        agentId: BigInt(p.sub),
        merchantId: BigInt(p.merchantId),
        branchId: BigInt(p.branchId),
        clientId: BigInt(request.body.clientId),
        amountTiyin: deal.amount ?? BigInt(0),
      }).catch((err) => app.log.warn({ err }, 'notifyDealCreated failed'))

      notifyDealDecision(db, {
        dealId: deal.id,
        clientId: BigInt(request.body.clientId),
        scoringDecision: scoringDecision ?? null,
        lang: lang ?? 'ru',
      }).catch((err) => app.log.warn({ err }, 'notifyDealDecision failed'))

      return reply.code(201).send({ dealId: deal.id, dealNumber: formatDealNumber(deal.dealNumber) })
    },
  )

  /* ── GET / — list deals ───────────────────────────────────────────────── */

  fastify.get(
    '/',
    { schema: { querystring: ListDealsQuery }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const p = payload(request)
      const merchantId = BigInt(p.merchantId)
      const agentId = p.role === 'agent' ? BigInt(p.sub) : undefined
      const { sortBy, sortOrder } = request.query as { sortBy?: string; sortOrder?: string }
      const list = await listDeals(db, merchantId, agentId, { sortBy, sortOrder })
      return { deals: list }
    },
  )

  /* ── GET /:id — deal detail ───────────────────────────────────────────── */

  fastify.get(
    '/:id',
    { schema: { params: IdParams }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request)
      const merchantId = BigInt(p.merchantId)
      const result = await getDealById(db, request.params.id, merchantId)
      if (!result) return reply.code(404).sendError('deal_not_found')
      const { schedule: _schedule, ...deal } = result
      return { deal }
    },
  )

  /* ── GET /:id/contract-pdf — get or generate Kontrakt PDF ────────────── */

  fastify.get(
    '/:id/contract-pdf',
    { schema: { params: IdParams }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request)
      const merchantId = BigInt(p.merchantId)
      try {
        const url = await getContractPdfUrl(app.db, app.minio, request.params.id, merchantId)
        return { url }
      } catch (err: any) {
        if (err.statusCode === 404) return reply.code(404).sendError('deal_not_found')
        throw err
      }
    },
  )
}
