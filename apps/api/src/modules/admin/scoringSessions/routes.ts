import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { listScoringSessions } from './queries/list-scoring-sessions'
import { getScoringSession } from './queries/get-scoring-session'

export default async function adminScoringSessionsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })

  fastify.get('/', async () => {
    const sessions = await listScoringSessions(db)
    return { sessions }
  })

  fastify.get('/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const session = await getScoringSession(db, request.params.id)
    if (!session) return reply.code(404).sendError('session_not_found')
    return { session }
  })
}
