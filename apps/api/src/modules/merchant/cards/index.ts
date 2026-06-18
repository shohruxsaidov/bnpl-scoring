import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { eq } from 'drizzle-orm'
import { db } from '@db'
import { clients } from '@db/schema'
import { listCards } from '../../integrations/plumgate/queries/list-cards/list-cards.handler'
import { addCard } from '../../integrations/plumgate/commands/add-card/add-card.handler'
import { confirmCard } from '../../integrations/plumgate/commands/confirm-card/confirm-card.handler'
import { scoreCard } from '../../integrations/plumgate/queries/score-card/score-card.handler'
import { createScoring } from '../scoringHistory/commands/create-scoring/create-scoring.handler'
import { loadOwnedActiveSession, saveStep, stampScoring, type SessionStepData } from '../deal-sessions/service/service.handler'
import type { CriteriaScores } from '../../scoring/service/service.handler'

export default async function merchantCardRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

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
    // Card display fields — written to the session's card step server-side
    maskedPan: Type.String({ minLength: 1 }),
    bank: Type.String({ minLength: 1 }),
    holderName: Type.String(),
    expiry: Type.String({ minLength: 1 }),
  })

  // ── Helper ───────────────────────────────────────────────────────────────

  async function requireClient(clientId: string) {
    const [client] = await db
      .select({ id: clients.id, phone: clients.phone, pinfl: clients.pinfl })
      .from(clients)
      .where(eq(clients.id, Number(clientId)))
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

      const cards = await listCards(clientId)
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

      const result = await addCard({
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
      const card = await confirmCard({ sessionId, otp })
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
      console.log('[score] ── incoming request ──')
      console.log('[score] body:', JSON.stringify(request.body))
      const p = request.user as { sub: string; merchantId: string }
      console.log('[score] user:', JSON.stringify(p))
      const { plumCardId, pcType, clientId, dealSessionId, maskedPan, bank, holderName, expiry } = request.body
      console.log('[score] requireClient, clientId:', clientId)
      await requireClient(clientId)
      console.log('[score] requireClient OK')

      let session
      try {
        console.log('[score] loading session:', dealSessionId, 'for sub:', p.sub)
        session = await loadOwnedActiveSession(dealSessionId, Number(p.sub))
        console.log('[score] session loaded:', JSON.stringify({ id: session.id, status: session.status, stepData: session.stepData }, (_, v) => typeof v === 'bigint' ? v.toString() : v))
      } catch (err: any) {
        console.log('[score] session load failed, code:', err.code, 'message:', err.message)
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found')
        if (err.code === 'session_not_active') return reply.code(409).sendError('session_not_active')
        throw err
      }

      console.log('[score] calling scoreCard, plumCardId:', plumCardId, 'pcType:', pcType)
      const result = await scoreCard({ plumCardId, pcType })   // { score, limit, decision }
      console.log('[score] scoreCard result:', JSON.stringify(result))

      const coefficient = result.score >= 700 ? 1.0 : result.score >= 600 ? 0.8 : 0
      console.log('[score] coefficient:', coefficient)

      // Scoring breakdown: KATM bureau, card (Plum), client identity (MyID)
      const katm = (session.stepData as SessionStepData).katm
      console.log('[score] katm from session:', JSON.stringify(katm))

      const [clientRow] = await db
        .select({ birthDate: clients.birthDate, gender: clients.gender, nationality: clients.nationality })
        .from(clients)
        .where(eq(clients.id, Number(clientId)))
        .limit(1)

      const criteriaScores: CriteriaScores = {
        ...(katm && {
          katm: {
            katmScore: katm.score,
            detail: {
              katmScore: katm.score,
              katmClass: katm.scoringClass,
              scoringLevel: katm.scoringLevel,
              openCredits: katm.activeLoans,
              totalDebt: katm.allDebtSum,
              overdueInOpenCredits: katm.overdueAmount,
              totalContracts: katm.totalContracts,
              totalClaims: katm.totalClaims,
              overdueCount: katm.overdueCount,
              maxOverdueDays: katm.maxOverdueDays,
              maxOverdueSum: katm.overdueAmount,
              avgMonthlyPayment: katm.avgMonthlyPayment,
              hasCreditBan: katm.hasCreditBan,
            },
          },
        }),
        card: {
          score: result.score,
          detail: {
            score: result.score,
            limit: result.limit,
            decision: result.decision,
            pcType,
            bank,
            maskedPan,
            holderName,
          },
        },
        ...(clientRow && {
          client: {
            detail: {
              birthDate: clientRow.birthDate,
              gender: clientRow.gender,
              nationality: clientRow.nationality,
            },
          },
        }),
      }
      console.log('[score] criteriaScores:', JSON.stringify(criteriaScores))

      // Record the run so it appears in the admin history even if no deal is
      // ever created; non-blocking — the wizard may continue if recording fails
      let scoringId: string | null = null
      try {
        console.log('[score] createScoring, merchantId:', p.merchantId, 'clientId:', clientId, 'limit:', Math.round(result.limit))
        const res = await createScoring({
          merchantId: Number(p.merchantId),
          clientId: Number(clientId),
          scoreSum: result.score,
          coefficient,
          decision: result.decision,
          platformCreditLimit: Number(Math.round(result.limit)),
          criteriaScores: criteriaScores as Record<string, unknown>,
        })
        scoringId = res.id
        console.log('[score] createScoring OK, scoringId:', scoringId)
      } catch (err) {
        console.log('[score] createScoring FAILED:', err)
        request.log.warn({ err }, 'scoring history record failed')
      }

      // Save the card step first so the session always has card data even if
      // the client never reaches the frontend's step-save call.
      console.log('[score] saveStep card onto session:', session.id?.toString?.() ?? session.id)
      const sessionAfterCard = await saveStep(session, 'card', {
        cardId: plumCardId,
        maskedPan,
        pcType,
        bank,
        holderName,
        expiry,
      })
      console.log('[score] saveStep card OK')

      console.log('[score] stampScoring onto session:', sessionAfterCard.id?.toString?.() ?? sessionAfterCard.id)
      await stampScoring(sessionAfterCard, {
        cardId: plumCardId,
        scoringId,
        scoreSum: result.score,
        coefficient,
        decision: result.decision,
        platformCreditLimit: result.limit,
        criteriaScores: criteriaScores as Record<string, unknown>,
      })
      console.log('[score] stampScoring OK')

      const response = { ...result, scoringId, coefficient, criteriaScores }
      console.log('[score] responding:', JSON.stringify(response))
      return response
    },
  )
}
