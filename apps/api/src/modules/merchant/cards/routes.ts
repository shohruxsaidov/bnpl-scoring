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
import { createScoring } from '../scoringHistory/commands/create-scoring'
import { loadOwnedActiveSession, stampScoring, type SessionStepData } from '../deal-sessions/service'

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
    clientId: Type.String({ minLength: 1 }),
    dealSessionId: Type.String({ minLength: 1 }),
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
  // Runs the card score, then stamps the full scoring result onto the Deal
  // Session server-side (ADR-0024 / ADR-0022 — the client never carries
  // scoring data; deal creation reads it back from the session).

  fastify.post(
    '/score',
    { schema: { body: ScoreBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = request.user as { sub: string; merchantId: string }
      const { plumCardId, pcType, clientId, dealSessionId } = request.body
      await requireClient(clientId)

      let session
      try {
        session = await loadOwnedActiveSession(db, dealSessionId, BigInt(p.sub))
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found')
        if (err.code === 'session_not_active') return reply.code(409).sendError('session_not_active')
        throw err
      }

      const result = await scoreCard(db, { plumCardId, pcType })   // { score, limit, decision }

      const coefficient = result.score >= 700 ? 1.0 : result.score >= 600 ? 0.8 : 0

      // Scoring breakdown: card score + KATM-derived credit signals from the session
      const katm = (session.stepData as SessionStepData).katm
      const criteriaScores: Record<string, number> = { cardScore: result.score }
      if (katm) {
        criteriaScores['katmScore'] = katm.score
        criteriaScores['activeLoans'] = katm.activeLoans
        criteriaScores['overdueCount'] = katm.overdueCount
      }

      // Record the run so it appears in the admin history even if no deal is
      // ever created; non-blocking — the wizard may continue if recording fails
      let scoringId: string | null = null
      try {
        const res = await createScoring(db, {
          merchantId: BigInt(p.merchantId),
          clientId: BigInt(clientId),
          scoreSum: result.score,
          coefficient,
          decision: result.decision,
          platformCreditLimit: BigInt(Math.round(result.limit)),
          criteriaScores,
        })
        scoringId = res.id
      } catch (err) {
        request.log.warn({ err }, 'scoring history record failed')
      }

      await stampScoring(db, session, {
        cardId: plumCardId,
        scoringId,
        scoreSum: result.score,
        coefficient,
        decision: result.decision,
        platformCreditLimit: result.limit,
        criteriaScores,
      })

      return { ...result, scoringId, coefficient, criteriaScores }
    },
  )
}
