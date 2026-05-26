import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { addBlacklistEntry, getAdminById, listBlacklist, removeBlacklistEntry } from './service.js'

function serialize(row: {
  id: bigint
  type: string
  value: string
  reason: string | null
  addedByAdminId: bigint
  addedByName: string | null
  createdAt: Date
}) {
  return {
    id: row.id.toString(),
    type: row.type,
    value: row.value,
    reason: row.reason ?? null,
    addedByAdminId: row.addedByAdminId.toString(),
    addedByName: row.addedByName ?? 'Unknown',
    createdAt: row.createdAt.toISOString(),
  }
}

export default async function adminBlacklistRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const IdParams = Type.Object({ id: Type.String() })

  const CreateBody = Type.Object({
    type: Type.Union([Type.Literal('pinfl'), Type.Literal('inn')]),
    value: Type.String({ minLength: 1 }),
    reason: Type.Optional(Type.String()),
  })

  fastify.get('/', { preHandler }, async () => {
    const rows = await listBlacklist(db)
    return { entries: rows.map(serialize) }
  })

  fastify.post('/', { schema: { body: CreateBody }, preHandler }, async (request, reply) => {
    const adminId = BigInt((request.user as { sub: string }).sub)
    const entry = await addBlacklistEntry(db, {
      type: request.body.type,
      value: request.body.value.trim(),
      reason: request.body.reason?.trim() || null,
      addedByAdminId: adminId,
    })
    const admin = await getAdminById(db, adminId)
    return reply.code(201).send({
      entry: serialize({
        ...entry,
        addedByName: admin?.fullName ?? null,
      }),
    })
  })

  fastify.delete('/:id', { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    const entry = await removeBlacklistEntry(db, BigInt(request.params.id))
    if (!entry) return reply.code(404).send({ code: 'not_found' })
    return reply.code(204).send()
  })
}
