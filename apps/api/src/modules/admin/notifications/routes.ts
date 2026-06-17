import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { desc, eq, ilike, or } from 'drizzle-orm'
import { notificationBroadcasts } from '../../notifications/db/schema'
import { createNotification } from '../../notifications/service'
import { merchantUsers, users } from '@db/schema'

export default async function adminNotificationRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  /* ── GET /clients/search?q=X ─────────────────────────────────────────────── */

  const ClientSearchQuery = Type.Object({
    q: Type.String({ minLength: 1, maxLength: 100 }),
  })

  fastify.get(
    '/clients/search',
    { schema: { querystring: ClientSearchQuery }, preHandler },
    async (request) => {
      const q = request.query.q.trim()
      const rows = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, pinfl: users.pinfl, phone: users.phone })
        .from(users)
        .where(
          or(
            ilike(users.pinfl, `%${q}%`),
            ilike(users.firstName, `%${q}%`),
            ilike(users.lastName, `%${q}%`),
          ),
        )
        .limit(20)
      return {
        clients: rows.map((r) => ({
          id: r.id.toString(),
          fullName: `${r.firstName} ${r.lastName}`,
          pinfl: r.pinfl,
          phone: r.phone,
        })),
      }
    },
  )

  /* ── GET /broadcasts — history ───────────────────────────────────────────── */

  fastify.get('/broadcasts', { preHandler }, async () => {
    const rows = await db
      .select()
      .from(notificationBroadcasts)
      .orderBy(desc(notificationBroadcasts.createdAt))
      .limit(100)

    return {
      broadcasts: rows.map((r) => ({
        id: r.id,
        adminId: r.adminId.toString(),
        targetType: r.targetType,
        targetId: r.targetId,
        title: r.title,
        body: r.body,
        recipientCount: r.recipientCount,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  })

  /* ── POST /broadcast — send ──────────────────────────────────────────────── */

  const BroadcastBody = Type.Object({
    /** 'employee' | 'merchant_employees' | 'client' | 'all_clients' */
    targetType: Type.Union([
      Type.Literal('employee'),
      Type.Literal('merchant_employees'),
      Type.Literal('client'),
      Type.Literal('all_clients'),
    ]),
    /** Required for employee, merchant_employees, client */
    targetId: Type.Optional(Type.String({ minLength: 1 })),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    body: Type.String({ minLength: 1, maxLength: 2000 }),
  })

  fastify.post('/broadcast', { schema: { body: BroadcastBody }, preHandler }, async (request, reply) => {
    const adminPayload = request.user as { sub: string }
    const adminId = Number(adminPayload.sub)
    const { targetType, targetId, title, body } = request.body

    type Recipient = { actorType: 'employee' | 'client'; actorId: number }
    let recipients: Recipient[] = []

    if (targetType === 'employee') {
      if (!targetId) return reply.code(400).sendError('target_id_required')
      recipients = [{ actorType: 'employee', actorId: Number(targetId) }]
    } else if (targetType === 'merchant_employees') {
      if (!targetId) return reply.code(400).sendError('target_id_required')
      const rows = await db
        .select({ id: merchantUsers.id })
        .from(merchantUsers)
        .where(eq(merchantUsers.merchantId, Number(targetId)))
      recipients = rows.map((r) => ({ actorType: 'employee' as const, actorId: r.id }))
    } else if (targetType === 'client') {
      if (!targetId) return reply.code(400).sendError('target_id_required')
      recipients = [{ actorType: 'client', actorId: Number(targetId) }]
    } else {
      // all_clients
      const rows = await db.select({ id: users.id }).from(users)
      recipients = rows.map((r) => ({ actorType: 'client' as const, actorId: r.id }))
    }

    if (recipients.length === 0) {
      return reply.code(400).sendError('no_recipients')
    }

    // Fan out — create one notification row per recipient
    await Promise.all(
      recipients.map((r) =>
        createNotification(db, {
          actorType: r.actorType,
          actorId: r.actorId,
          type: 'admin_message',
          params: { title, body },
        }),
      ),
    )

    // Record the broadcast action for history
    await db.insert(notificationBroadcasts).values({
      adminId,
      targetType,
      targetId: targetId ?? null,
      title,
      body,
      recipientCount: recipients.length,
    })

    return reply.code(201).send({ ok: true, recipientCount: recipients.length })
  })
}
