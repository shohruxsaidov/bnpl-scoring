import { randomBytes } from 'crypto'
import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { eq } from 'drizzle-orm'
import { clients } from '../../id/db/schema'
import { queryInfoscore } from '../../integrations/katm/service'

export default async function merchantKatmRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const QueryBody = Type.Object({
    clientId: Type.String({ minLength: 1 }),
  })

  /**
   * POST /merchant/katm/query
   * Runs a KATM InfoScore 077 request for the given client.
   * Returns a summary; the full raw payload is preserved in infoscore_raw on the deal.
   */
  fastify.post(
    '/query',
    { schema: { body: QueryBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const { clientId } = request.body

      const [client] = await db
        .select({ id: clients.id, pinfl: clients.pinfl })
        .from(clients)
        .where(eq(clients.id, BigInt(clientId)))
        .limit(1)

      if (!client) return reply.code(404).sendError('client_not_found')
      if (!client.pinfl) return reply.code(422).sendError('client_pinfl_missing')

      // Generate short random IDs matching KATM's expected pattern
      const claimId = randomBytes(15).toString('base64url').slice(0, 20)
      const consentId = randomBytes(8).toString('base64url').slice(0, 10)

      const result = await queryInfoscore(db, {
        pinfl: client.pinfl,
        claimId,
        consentId,
      })

      return {
        demandId: result.demandId,
        consentId: result.consentId,
        score: result.score,
        scoringClass: result.scoringClass,
        scoringLevel: result.scoringLevel,
        activeLoans: result.activeLoans,
        allDebtSum: result.allDebtSum,
        overdueCount: result.overdueCount,
        overdueAmount: result.overdueAmount,
        hasDefaults: result.hasDefaults,
        hasCreditBan: result.hasCreditBan,
      }
    },
  )
}
