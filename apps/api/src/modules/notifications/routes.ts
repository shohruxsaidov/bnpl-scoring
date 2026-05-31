import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { sseSubscribe } from '../../lib/sse'
import {
  listNotifications,
  markOneRead,
  markAllRead,
  deleteRead,
  toDto,
  type ActorType,
} from './service'

type AnyPayload =
  | { sub: string; type: 'client' }
  | { sub: string; type: 'admin'; roleId: string | null }
  | { sub: string; type: 'merchant'; merchantId: string; branchId: string; role: string; roleId: string }

function actorFrom(user: AnyPayload): { actorType: ActorType; actorId: bigint } {
  if (user.type === 'merchant') return { actorType: 'employee', actorId: BigInt(user.sub) }
  if (user.type === 'admin') return { actorType: 'admin', actorId: BigInt(user.sub) }
  return { actorType: 'client', actorId: BigInt(user.sub) }
}

export default async function notificationRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  async function verifyAny(request: FastifyRequest, reply: FastifyReply) {
    const c = request.cookies as Record<string, string>
    const tryVerify = (token: string, expectedType: string): boolean => {
      try {
        const p = app.jwt.verify<AnyPayload>(token)
        if (p.type === expectedType) {
          request.user = p
          return true
        }
      } catch {}
      return false
    }
    if (c.merchant_access_token && tryVerify(c.merchant_access_token, 'merchant')) return
    if (c.admin_access_token && tryVerify(c.admin_access_token, 'admin')) return
    if (c.access_token && tryVerify(c.access_token, 'client')) return
    await reply.code(401).send({ code: 'unauthorized' })
  }

  /* ── GET / — list ─────────────────────────────────────────────────────── */

  fastify.get('/', { preHandler: verifyAny }, async (request) => {
    const { actorType, actorId } = actorFrom(request.user as AnyPayload)
    const rows = await listNotifications(db, actorType, actorId)
    return { notifications: rows.map(toDto) }
  })

  /* ── PATCH /:id/read — mark one ───────────────────────────────────────── */

  const IdParams = Type.Object({ id: Type.String() })

  fastify.patch(
    '/:id/read',
    { schema: { params: IdParams }, preHandler: verifyAny },
    async (request) => {
      const { actorType, actorId } = actorFrom(request.user as AnyPayload)
      await markOneRead(db, request.params.id, actorType, actorId)
      return { ok: true }
    },
  )

  /* ── POST /read-all — mark all ────────────────────────────────────────── */

  fastify.post('/read-all', { preHandler: verifyAny }, async (request) => {
    const { actorType, actorId } = actorFrom(request.user as AnyPayload)
    await markAllRead(db, actorType, actorId)
    return { ok: true }
  })

  /* ── DELETE / — clear read ────────────────────────────────────────────── */

  fastify.delete('/', { preHandler: verifyAny }, async (request) => {
    const { actorType, actorId } = actorFrom(request.user as AnyPayload)
    await deleteRead(db, actorType, actorId)
    return { ok: true }
  })

  /* ── GET /stream — SSE ────────────────────────────────────────────────── */

  fastify.get('/stream', { preHandler: verifyAny }, (request, reply) => {
    const { actorType, actorId } = actorFrom(request.user as AnyPayload)
    if (actorType === 'client') {
      reply.code(403).send({ code: 'client_uses_push' })
      return
    }
    const raw = reply.raw

    reply.hijack()
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const unsubscribe = sseSubscribe(actorType, actorId.toString(), raw)

    const hb = setInterval(() => {
      try {
        raw.write(': heartbeat\n\n')
      } catch {
        cleanup()
      }
    }, 25_000)

    function cleanup() {
      clearInterval(hb)
      unsubscribe()
      try {
        raw.end()
      } catch {}
    }

    request.raw.on('close', cleanup)
  })
}
