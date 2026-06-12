import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import {
  getUserLimit,
  getScoringSessionStatus,
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
  // Creates a Scoring Session and runs the KATM consume flow (ADR-0025):
  // server-side consent record → ban pre-check → claim registration → report.
  // Returns { sessionId, katm, pending } — katm is null and pending true while
  // KATM builds the report asynchronously (poll GET /:sessionId/status).
  // Optional katmDetails backfills address/region/district/docType for users
  // rows created before those fields were captured from MyID.
  fastify.post(
    '/start',
    {
      schema: {
        body: Type.Object({
          katmDetails: Type.Optional(
            Type.Object({
              address: Type.String({ minLength: 1, maxLength: 100 }),
              regionCode: Type.String({ minLength: 1, maxLength: 2, pattern: '^\\d{1,2}$' }),
              districtCode: Type.String({ minLength: 1, maxLength: 3, pattern: '^\\d{1,3}$' }),
              docType: Type.Union([Type.Literal(0), Type.Literal(6)]),
            }),
          ),
        }),
      },
      preHandler: app.verifyClientJwt,
    },
    async (request, reply) => {
      const result = await startScoringSession(app.db, app.katmPollQueue, {
        userId: userId(request),
        katmDetails: request.body.katmDetails,
      })
      return reply.code(201).send(result)
    },
  )

  // ── GET /client/scoring/:sessionId/status ─────────────────────────────────
  // Polled by the portal while the KATM report is pending.
  fastify.get(
    '/:sessionId/status',
    { schema: { params: SessionParams }, preHandler: app.verifyClientJwt },
    async (request, reply) => {
      try {
        return await getScoringSessionStatus(app.db, request.params.sessionId, userId(request))
      } catch (err: any) {
        if (err.statusCode === 404) return reply.code(404).sendError('session_not_found')
        throw err
      }
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
