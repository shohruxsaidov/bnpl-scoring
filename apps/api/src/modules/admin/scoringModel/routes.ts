import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { getActiveModel, getModelById, listModels, saveModel } from './service.js'
import { computeScoringModel } from '../../scoring/engine.js'
import type { ScoringModelParams, ScoringInputs } from '../../scoring/engine.js'

function serializeRevision(row: NonNullable<Awaited<ReturnType<typeof getActiveModel>>>) {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    params: row.params,
    createdAt: row.createdAt.toISOString(),
  }
}

export default async function adminScoringModelRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  // Active (latest) revision
  fastify.get('/', async (_, reply) => {
    const row = await getActiveModel(db)
    if (!row) return reply.code(404).sendError('not_found')
    return serializeRevision(row)
  })

  // History list (id, name, version, createdAt only — no params)
  fastify.get('/history', async () => {
    const rows = await listModels(db)
    return {
      revisions: rows.map((r) => ({
        id: r.id,
        name: r.name,
        version: r.version,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  })

  // Specific revision by id (full params — for loading an old revision into the editor)
  fastify.get(
    '/:id',
    { schema: { params: Type.Object({ id: Type.String() }) } },
    async (request, reply) => {
      const row = await getModelById(db, parseInt(request.params.id, 10))
      if (!row) return reply.code(404).sendError('not_found')
      return serializeRevision(row)
    },
  )

  // Try a specific revision against provided inputs
  const TryBody = Type.Object({
    incomeSum:                 Type.Optional(Type.Number()),
    workExperienceMonths:      Type.Optional(Type.Number()),
    age:                       Type.Optional(Type.Number()),
    citizenship:               Type.Optional(Type.Union([Type.Literal('Uzbekistan'), Type.Literal('NonResident')])),
    gender:                    Type.Optional(Type.Union([Type.Literal('Male'), Type.Literal('Female')])),
    monthlyPaymentRatio:       Type.Optional(Type.Number()),
    overduePrincipalContracts: Type.Optional(Type.Number()),
    contingentLiability:       Type.Optional(Type.Number()),
    overdue30Count:            Type.Optional(Type.Number()),
    overdue30to60Count:        Type.Optional(Type.Number()),
    overdue60to90Count:        Type.Optional(Type.Number()),
    overdue90Count:            Type.Optional(Type.Number()),
    hasJuridical:              Type.Optional(Type.Boolean()),
    hasDecommission:           Type.Optional(Type.Boolean()),
    loanApplicationCount:      Type.Optional(Type.Number()),
    coBorrowerMaxDays:         Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    guarantorMaxDays:          Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    pledgerMaxDays:            Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    hasMortgage:               Type.Optional(Type.Boolean()),
    passportRegion:            Type.Optional(Type.String()),
    allDebts:                  Type.Optional(Type.Number()),
  })

  fastify.post(
    '/:id/try',
    { schema: { params: Type.Object({ id: Type.String() }), body: TryBody } },
    async (request, reply) => {
      const row = await getModelById(db, parseInt(request.params.id, 10))
      if (!row) return reply.code(404).sendError('not_found')
      const result = computeScoringModel(row.params as unknown as ScoringModelParams, request.body as ScoringInputs)
      return result
    },
  )

  // Save new revision
  const SaveBody = Type.Object({
    name: Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    params: Type.Record(Type.String(), Type.Unknown()),
  })

  fastify.put('/', { schema: { body: SaveBody } }, async (request) => {
    const adminId = BigInt((request.user as { sub: string }).sub)
    const { name, version, params } = request.body
    const row = await saveModel(db, { name, version, params: params as never }, adminId)
    return serializeRevision(row)
  })
}
