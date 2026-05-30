import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { listScorings, getScoring, createScoring } from './service'

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
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })

  const CreateBody = Type.Object({
    clientId: Type.String({ minLength: 1 }),
    scoreSum: Type.Optional(Type.Number()),
    coefficient: Type.Optional(Type.Number()),
    decision: Type.String({ minLength: 1 }),
    platformCreditLimit: Type.Number(),
    criteriaScores: Type.Optional(Type.Record(Type.String(), Type.Number())),
  })

  /* ── POST / — record a scoring run (before any deal exists) ────────────── */
  fastify.post(
    '/',
    { schema: { body: CreateBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request)
      try {
        const res = await createScoring(db, {
          merchantId: BigInt(p.merchantId),
          clientId: BigInt(request.body.clientId),
          scoreSum: request.body.scoreSum ?? null,
          coefficient: request.body.coefficient ?? null,
          decision: request.body.decision,
          platformCreditLimit: BigInt(Math.round(request.body.platformCreditLimit)),
          criteriaScores: request.body.criteriaScores ?? null,
        })
        return reply.code(201).send(res)
      } catch (err: any) {
        if (err.code === 'client_not_found') return reply.code(404).send({ code: 'client_not_found' })
        throw err
      }
    },
  )

  /* ── GET / — list scoring runs for this merchant ──────────────────────── */
  fastify.get('/', { preHandler: app.verifyMerchantJwt }, async (request) => {
    const p = payload(request)
    const records = await listScorings(db, BigInt(p.merchantId))
    return { records }
  })

  /* ── GET /:id — single scoring run detail ─────────────────────────────── */
  fastify.get(
    '/:id',
    { schema: { params: IdParams }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request)

      let scoringId: bigint
      try {
        scoringId = BigInt(request.params.id)
      } catch {
        return reply.code(400).send({ code: 'invalid_id' })
      }

      const scoring = await getScoring(db, scoringId, BigInt(p.merchantId))
      if (!scoring) return reply.code(404).send({ code: 'scoring_not_found' })
      return { scoring }
    },
  )
}
