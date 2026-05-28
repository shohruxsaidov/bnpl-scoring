import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'

/** Deterministic mock scoring — real PlumGate integration goes here. */
function mockScore(cardId: string): { score: number; limit: number; decision: string } {
  // Simple hash of cardId → repeatable "random" values per card
  let h = 0
  for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) >>> 0
  const score = 580 + (h % 320) // 580 – 899
  const decision = score >= 700 ? 'approved' : score >= 600 ? 'manual_review' : 'declined'
  // Use >>> 0 to keep unsigned before modulo — avoids negative results
  const bucket = ((h >>> 4) >>> 0) % 10
  // limit in tiyin: 300_000_000 – 1_110_000_000 (3M – 11.1M som)
  const limit = 300_000_000 + bucket * 90_000_000
  return { score, limit, decision }
}

export default async function merchantCardRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  const ScoreBody = Type.Object({
    cardId: Type.String({ minLength: 1 }),
  })

  /**
   * POST /merchant/cards/score
   * Mock card-scoring endpoint — returns a score, decision, and approved credit limit.
   * Will be replaced by a real PlumGate call once the integration is live.
   */
  fastify.post(
    '/score',
    { schema: { body: ScoreBody }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const { cardId } = request.body
      // Simulate slight processing delay
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400))
      return mockScore(cardId)
    },
  )
}
