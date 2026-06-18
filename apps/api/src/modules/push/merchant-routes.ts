import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { upsertSubscription, deleteSubscription } from './service/service.handler';
import { env } from '../../env';

export default async function merchantPushRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const preHandler = app.verifyMerchantJwt;

  /* ── GET /vapid-key ─────────────────────────────────────────────────────── */

  fastify.get('/vapid-key', async () => ({ publicKey: env.VAPID_PUBLIC_KEY }));

  /* ── POST /subscribe ────────────────────────────────────────────────────── */

  const SubscribeBody = Type.Object({
    endpoint: Type.String({ minLength: 1 }),
    p256dh: Type.String({ minLength: 1 }),
    auth: Type.String({ minLength: 1 }),
  });

  fastify.post(
    '/subscribe',
    { schema: { body: SubscribeBody }, preHandler },
    async (request, reply) => {
      const employeeId = +(request.user as { sub: string }).sub;
      await upsertSubscription('employee', employeeId, request.body);
      return reply.code(201).send({ ok: true });
    },
  );

  /* ── DELETE /subscribe ──────────────────────────────────────────────────── */

  const UnsubscribeBody = Type.Object({
    endpoint: Type.String({ minLength: 1 }),
  });

  fastify.delete(
    '/subscribe',
    { schema: { body: UnsubscribeBody }, preHandler },
    async (request) => {
      await deleteSubscription(request.body.endpoint);
      return { ok: true };
    },
  );
}
