import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import {
  getUserLimit,
  startScoringSession,
  addScoringCard,
  confirmScoringCard,
  completeScoringCard,
} from './service'

type ClientJwt = { sub: string; type: 'client' }

function userId(request: { user: unknown }): bigint {
  return BigInt((request.user as ClientJwt).sub)
}

export default async function scoringRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  const SessionParams = Type.Object({ sessionId: Type.String({ minLength: 1 }) })

  // ── GET /client/scoring/limit ─────────────────────────────────────────────
  // Returns the client's current User Limit, or null if not yet scored.
  fastify.get(
    '/limit',
    { preHandler: app.verifyClientJwt },
    async (request) => {
      const limit = await getUserLimit(app.db, userId(request))
      return { limit }
    },
  )

  // ── POST /client/scoring/start ────────────────────────────────────────────
  // Creates a Scoring Session and runs KATM. Returns KATM result and sessionId.
  // The card_scoring pipeline stays 'pending' until the client adds their card.
  fastify.post(
    '/start',
    {
      schema: {
        body: Type.Object({
          consentId: Type.String({ minLength: 1 }),
          consentDate: Type.String({ minLength: 10, maxLength: 10 }),
        }),
      },
      preHandler: app.verifyClientJwt,
    },
    async (request, reply) => {
      const result = await startScoringSession(app.db, {
        userId: userId(request),
        consentId: request.body.consentId,
        consentDate: request.body.consentDate,
      })
      return reply.code(201).send(result)
    },
  )

  // ── POST /client/scoring/:sessionId/card/add ──────────────────────────────
  // Registers the card in PlumGate. PlumGate sends an OTP to the client's phone.
  // Returns { sessionId: plumgateSessionId, maskedPhone } for the confirm step.
  fastify.post(
    '/:sessionId/card/add',
    {
      schema: {
        params: SessionParams,
        body: Type.Object({
          cardNumber: Type.String({ minLength: 16, maxLength: 19 }),
          expiry: Type.String({ minLength: 4, maxLength: 5 }),
        }),
      },
      preHandler: app.verifyClientJwt,
    },
    async (request, reply) => {
      try {
        const result = await addScoringCard(app.db, {
          sessionId: request.params.sessionId,
          userId: userId(request),
          cardNumber: request.body.cardNumber,
          expiry: request.body.expiry,
        })
        return reply.send(result)
      } catch (err: any) {
        if (err.statusCode === 404) return reply.code(404).sendError('session_not_found')
        if (err.message === 'session_not_running') return reply.code(409).sendError('session_not_running')
        if (err.message === 'katm_not_completed') return reply.code(409).sendError('katm_not_completed')
        throw err
      }
    },
  )

  // ── POST /client/scoring/:sessionId/card/confirm ──────────────────────────
  // Confirms the OTP to complete card registration.
  // Returns the registered card { plumCardId, maskedPan, bank, pcType, ... }.
  fastify.post(
    '/:sessionId/card/confirm',
    {
      schema: {
        params: SessionParams,
        body: Type.Object({
          plumgateSessionId: Type.String({ minLength: 1 }),
          otp: Type.String({ minLength: 4, maxLength: 8 }),
        }),
      },
      preHandler: app.verifyClientJwt,
    },
    async (request, reply) => {
      try {
        const result = await confirmScoringCard(app.db, {
          sessionId: request.params.sessionId,
          userId: userId(request),
          plumgateSessionId: request.body.plumgateSessionId,
          otp: request.body.otp,
        })
        return reply.send(result)
      } catch (err: any) {
        if (err.statusCode === 404) return reply.code(404).sendError('session_not_found')
        if (err.message === 'session_not_running') return reply.code(409).sendError('session_not_running')
        throw err
      }
    },
  )

  // ── POST /client/scoring/:sessionId/card/score ────────────────────────────
  // Runs PlumGate scoring for the confirmed card. Finalizes the session:
  // writes user_limits (upsert) + scoring_histories (audit).
  // Returns { scoreSum, coefficient, decision, platformCreditLimit, criteriaScores }.
  fastify.post(
    '/:sessionId/card/score',
    {
      schema: {
        params: SessionParams,
        body: Type.Object({
          plumCardId: Type.String({ minLength: 1 }),
          pcType: Type.Union([Type.Literal('uzcard'), Type.Literal('humo')]),
        }),
      },
      preHandler: app.verifyClientJwt,
    },
    async (request, reply) => {
      try {
        const result = await completeScoringCard(app.db, {
          sessionId: request.params.sessionId,
          userId: userId(request),
          plumCardId: request.body.plumCardId,
          pcType: request.body.pcType,
        })
        return reply.send(result)
      } catch (err: any) {
        if (err.statusCode === 404) return reply.code(404).sendError('session_not_found')
        if (err.message === 'session_not_running') return reply.code(409).sendError('session_not_running')
        if (err.message === 'katm_not_completed') return reply.code(409).sendError('katm_not_completed')
        if (err.message === 'card_scoring_already_started') return reply.code(409).sendError('card_scoring_already_started')
        throw err
      }
    },
  )
}
