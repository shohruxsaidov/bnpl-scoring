import { randomBytes } from 'crypto'
import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { eq } from 'drizzle-orm'
import { clients } from '../../id/db/schema'
import { queryInfoscore } from '../../integrations/katm/service'
import { loadOwnedActiveSession, stampKatm } from '../deal-sessions/service'

type JwtPayload = { sub: string; merchantId: string; branchId: string; role: string }

export default async function merchantKatmRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const QueryBody = Type.Object({
    clientId: Type.String({ minLength: 1 }),
    dealSessionId: Type.String({ minLength: 1 }),
  })

  /**
   * POST /merchant/katm/query
   * Runs a KATM InfoScore 077 request for the given client. The Deal Session
   * UUID is sent as claim_id so every bureau pull is traceable to its Wizard
   * run, and the result (incl. raw payload) is stamped onto the session —
   * abandoned runs keep their bureau data (ADR-0024).
   */
  fastify.post(
    '/query',
    { schema: { body: QueryBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = request.user as JwtPayload
      const { clientId, dealSessionId } = request.body

      let session
      try {
        session = await loadOwnedActiveSession(db, dealSessionId, BigInt(p.sub))
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found')
        if (err.code === 'session_not_active') return reply.code(409).sendError('session_not_active')
        throw err
      }

      const [client] = await db
        .select({ id: clients.id, pinfl: clients.pinfl })
        .from(clients)
        .where(eq(clients.id, BigInt(clientId)))
        .limit(1)

      if (!client) return reply.code(404).sendError('client_not_found')
      if (!client.pinfl) return reply.code(422).sendError('client_pinfl_missing')

      // claim_id = Deal Session UUID (ADR-0024); consent_id stays a one-off code
      const claimId = session.id
      const consentId = randomBytes(8).toString('base64url').slice(0, 10)

      const result = await queryInfoscore(db, {
        pinfl: client.pinfl,
        claimId,
        consentId,
      })

      const summary = {
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

      await stampKatm(db, session, {
        clientId,
        claimId,
        consentDate: new Date().toISOString().slice(0, 10),
        raw: result.raw ?? null,
        ...summary,
      })

      return summary
    },
  )
}
