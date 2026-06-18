import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { createScoring } from './commands/create-scoring/create-scoring.handler'

type JwtPayload = {
  sub: string
  merchantId: string
  branchId: string
  role: string
}

function payload(request: { user: unknown }) {
  return request.user as JwtPayload
}

export default async function merchantScoringHistoryRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  const CreateBody = Type.Object({
    userId: Type.String({ minLength: 1 }),
    scoreSum: Type.Optional(Type.Number()),
    coefficient: Type.Optional(Type.Number()),
    decision: Type.String({ minLength: 1 }),
    platformCreditLimit: Type.Number(),
    criteriaScores: Type.Optional(Type.Unknown()),
  })

  /* ── POST / — record a scoring run (before any deal exists) ────────────── */
  fastify.post(
    '/',
    { schema: { body: CreateBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request)
      try {
        const res = await createScoring({
          merchantId: Number(p.merchantId),
          userId: Number(request.body.userId),
          scoreSum: request.body.scoreSum ?? null,
          coefficient: request.body.coefficient ?? null,
          decision: request.body.decision,
          platformCreditLimit: Number(Math.round(request.body.platformCreditLimit)),
          criteriaScores: (request.body.criteriaScores as Record<string, unknown>) ?? null,
        })
        return reply.code(201).send(res)
      } catch (err: any) {
        if (err.code === 'user_not_found') return reply.code(404).sendError('user_not_found')
        throw err
      }
    },
  )
}
