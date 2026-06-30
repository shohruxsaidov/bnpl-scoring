import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { lookupMxik } from './queries/lookup-mxik/lookup-mxik.handler'
import { searchMxik } from './queries/search-mxik/search-mxik.handler'

export default async function mxikRoutes(app: FastifyInstance, opts: { preHandler: unknown }) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const preHandler = opts.preHandler as FastifyInstance['verifyMerchantJwt']

  const TAGS = ['MXIK']

  const LookupQuery = Type.Object({ code: Type.String({ minLength: 17, maxLength: 17 }) })
  const SearchQuery = Type.Object({ q: Type.String({ minLength: 2 }) })

  fastify.get('/lookup', { schema: { tags: TAGS, querystring: LookupQuery }, preHandler }, async (request, reply) => {
    try {
      const entry = await lookupMxik(request.query.code)
      return { mxik: entry }
    } catch {
      return reply.code(404).sendError('mxik_not_found')
    }
  })

  fastify.get('/search', { schema: { tags: TAGS, querystring: SearchQuery }, preHandler }, async (request) => {
    const results = await searchMxik(request.query.q)
    return { results }
  })
}
