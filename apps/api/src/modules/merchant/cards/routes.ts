import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { eq } from 'drizzle-orm'
import { clients } from '../../id/db/schema'
import {
  listCards,
  addCard,
  confirmCard,
  scoreCard,
} from '../../integrations/plumgate/service'

export default async function merchantCardRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  // ── Schemas ──────────────────────────────────────────────────────────────

  const ListQuery = Type.Object({
    clientId: Type.String({ minLength: 1 }),
  })

  const AddBody = Type.Object({
    clientId: Type.String({ minLength: 1 }),
    cardNumber: Type.String({ minLength: 16, maxLength: 19 }),
    expiry: Type.String({ minLength: 4, maxLength: 5 }),   // "MMYY" or "MM/YY"
  })

  const ConfirmBody = Type.Object({
    sessionId: Type.String({ minLength: 1 }),
    otp: Type.String({ minLength: 4, maxLength: 8 }),
  })

  const ScoreBody = Type.Object({
    plumCardId: Type.String({ minLength: 1 }),
    pcType: Type.Union([Type.Literal('uzcard'), Type.Literal('humo')]),
  })

  // ── Helper ───────────────────────────────────────────────────────────────

  async function requireClient(clientId: string) {
    const [client] = await db
      .select({ id: clients.id, phone: clients.phone, pinfl: clients.pinfl })
      .from(clients)
      .where(eq(clients.id, BigInt(clientId)))
      .limit(1)

    if (!client) {
      throw Object.assign(new Error('Client not found'), { statusCode: 404 })
    }
    return client
  }

  // ── GET /merchant/cards?clientId=... ─────────────────────────────────────

  fastify.get(
    '/',
    { schema: { querystring: ListQuery }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const { clientId } = request.query
      await requireClient(clientId)

      const cards = await listCards(db, clientId)
      return { cards }
    },
  )

  // ── POST /merchant/cards/add ──────────────────────────────────────────────

  fastify.post(
    '/add',
    { schema: { body: AddBody }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const { clientId, cardNumber, expiry } = request.body
      const client = await requireClient(clientId)

      const result = await addCard(db, {
        clientId,
        phone: client.phone,
        cardNumber,
        expiry,
      })

      return result   // { sessionId, maskedPhone }
    },
  )

  // ── POST /merchant/cards/confirm ─────────────────────────────────────────

  fastify.post(
    '/confirm',
    { schema: { body: ConfirmBody }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const { sessionId, otp } = request.body
      const card = await confirmCard(db, { sessionId, otp })
      return { card }
    },
  )

  // ── POST /merchant/cards/score ────────────────────────────────────────────

  fastify.post(
    '/score',
    { schema: { body: ScoreBody }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const { plumCardId, pcType } = request.body
      const result = await scoreCard(db, { plumCardId, pcType })
      return result   // { score, limit, decision }
    },
  )
}
