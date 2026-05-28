import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { createDeal, listDeals, getDealById } from './service'
import { products, tariffs } from '../../id/db/schema'
import { eq } from 'drizzle-orm'

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
    /** scoreSum and decision from the client_scorings row (filled by StepKarta) */
    scoreSum: Type.Optional(Type.Number()),
    scoringDecision: Type.Optional(Type.String()),
  })

  const IdParams = Type.Object({ id: Type.String() })

  /* ── POST / — create deal ─────────────────────────────────────────────── */

  fastify.post(
    '/',
    { schema: { body: CreateDealBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request)

      // Only agents can create deals
      if (p.role !== 'agent') {
        return reply.code(403).send({ code: 'agent_only' })
      }

      // Verify the signing token (OTP consent proof)
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

      const { basket, paymentDay, scoreSum, scoringDecision } = request.body
      const clientId = BigInt(request.body.clientId)
      const tariffId = BigInt(request.body.tariffId)
      const merchantId = BigInt(p.merchantId)
      const branchId = BigInt(p.branchId)
      const agentId = BigInt(p.sub)

      // Resolve tariff to get markup and termMonths
      const [tariff] = await db.select().from(tariffs).where(eq(tariffs.id, tariffId)).limit(1)
      if (!tariff) return reply.code(400).send({ code: 'tariff_not_found' })

      // Resolve products for basket (snapshot names + prices)
      const productIds = basket.map((i) => BigInt(i.productId))
      const productRows = await Promise.all(
        productIds.map((id) =>
          db.select().from(products).where(eq(products.id, id)).limit(1),
        ),
      )

      let amount = BigInt(0)
      const resolvedBasket = basket.map((item, idx) => {
        const p = productRows[idx]?.[0]
        if (!p) throw new Error(`product_not_found:${item.productId}`)
        const itemTotal = BigInt(Math.round(parseFloat(p.tanNarxi) * 100)) * BigInt(item.quantity)
        amount += itemTotal
        return {
          productId: p.id,
          productName: p.name,
          tanNarxi: p.tanNarxi,
          mxikCode: p.mxikCode ?? null,
          packageCode: p.packageCode ?? null,
          packageName: p.packageName ?? null,
          quantity: item.quantity,
        }
      })

      const markupPercent = parseFloat(tariff.markupPercent)
      const totalPayable = BigInt(Math.round(Number(amount) * (1 + markupPercent / 100)))

      const deal = await createDeal(db, {
        merchantId,
        branchId,
        agentId,
        clientId,
        tariffId,
        basket: resolvedBasket,
        paymentDay,
        amount,
        totalPayable,
        termMonths: tariff.termMonths,
        markupPercent,
        scoreSum: scoreSum ?? null,
        scoringDecision: scoringDecision ?? null,
      })

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
      // Agents see only their own deals; admins see all
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
}
