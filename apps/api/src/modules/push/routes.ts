import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { upsertSubscription, deleteSubscription } from './service'
import { env } from '../../env'

export default async function pushRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyClientJwt

  /* ── GET /vapid-key ─────────────────────────────────────────────────────── */

  fastify.get('/vapid-key', async () => ({ publicKey: env.VAPID_PUBLIC_KEY }))

  /* ── POST /subscribe ────────────────────────────────────────────────────── */

  const SubscribeBody = Type.Object({
    endpoint: Type.String({ minLength: 1 }),
    p256dh: Type.String({ minLength: 1 }),
    auth: Type.String({ minLength: 1 }),
  })

  fastify.post(
    '/subscribe',
    { schema: { body: SubscribeBody }, preHandler },
    async (request, reply) => {
      const userId = BigInt((request.user as { sub: string }).sub)
      await upsertSubscription(db, userId, request.body)
      return reply.code(201).send({ ok: true })
    },
  )

  /* ── DELETE /subscribe ──────────────────────────────────────────────────── */

  const UnsubscribeBody = Type.Object({
    endpoint: Type.String({ minLength: 1 }),
  })

  fastify.delete(
    '/subscribe',
    { schema: { body: UnsubscribeBody }, preHandler },
    async (request) => {
      const userId = BigInt((request.user as { sub: string }).sub)
      await deleteSubscription(db, userId, request.body.endpoint)
      return { ok: true }
    },
  )
}
