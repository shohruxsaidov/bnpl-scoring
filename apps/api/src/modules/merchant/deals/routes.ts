import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { resolveAndCreateDeal, listDeals, getDealById, getContractPdfUrl } from './service'
import { notifyDealCreated } from '../../notifications/service'

type JwtPayload = {
  sub: string
  merchantId: string
  branchId: string
  role: string
}

function payload(request: { user: unknown }) {
  return request.user as JwtPayload
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

  /* ── POST / — create deal ─────────────────────────────────────────────── */

  fastify.post(
    '/',
    { schema: { body: CreateDealBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request)

      if (p.role !== 'agent') {
        return reply.code(403).send({ code: 'agent_only' })
      }

      let signingPayload: { phone: string; purpose: string }
      try {
        signingPayload = app.jwt.verify<{ phone: string; purpose: string }>(
          request.body.signingToken,
        )
      } catch {
        return reply.code(400).send({ code: 'invalid_signing_token' })
      }

      if (signingPayload.purpose !== 'deal_signing') {
        return reply.code(400).send({ code: 'invalid_signing_purpose' })
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
        if (err.code === 'tariff_not_found') return reply.code(400).send({ code: 'tariff_not_found' })
        if (err.code === 'product_not_found') return reply.code(400).send({ code: 'product_not_found' })
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

      return reply.code(201).send({ dealId: deal.id })
    },
  )

  /* ── GET / — list deals ───────────────────────────────────────────────── */

  fastify.get(
    '/',
    { preHandler: app.verifyMerchantJwt },
    async (request) => {
      const p = payload(request)
      const merchantId = BigInt(p.merchantId)
      const agentId = p.role === 'agent' ? BigInt(p.sub) : undefined
      const list = await listDeals(db, merchantId, agentId)
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
      const deal = await getDealById(db, request.params.id, merchantId)
      if (!deal) return reply.code(404).send({ code: 'deal_not_found' })
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
        if (err.statusCode === 404) return reply.code(404).send({ code: 'deal_not_found' })
        throw err
      }
    },
  )
}
