import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '@db';
import { users } from '@db/schema';
import { messaging } from '../../../lib/firebase';
import {
  countPushableDevicesForUser,
  sendCustomPush,
} from './commands/send-custom-push/send-custom-push.handler';

const TAGS = ['Admin · Notifications'];

export default async function adminNotificationsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  // Both languages are mandatory: the push worker renders per device language,
  // so a missing translation would reach an Uzbek-language phone as an empty push.
  const SendPushBody = Type.Object({
    userId: Type.Integer({ minimum: 1 }),
    titleRu: Type.String({ minLength: 1, maxLength: 120 }),
    titleUz: Type.String({ minLength: 1, maxLength: 120 }),
    bodyRu: Type.String({ minLength: 1, maxLength: 500 }),
    bodyUz: Type.String({ minLength: 1, maxLength: 500 }),
    // Minted when the compose dialog opens. A double-clicked Send button or a
    // retried request replays the same key and collapses to a single push.
    idempotencyKey: Type.String({ minLength: 8, maxLength: 64 }),
  });

  /**
   * POST /admin/notifications/push — send a hand-written push to one client.
   *
   * notify() is fire-and-forget by contract (it must never fail the scoring
   * pipeline), which would leave an admin staring at a success toast for a push
   * that went nowhere. So the deliverability preconditions are checked up front
   * and reported honestly. It stays best-effort after that: a token can still
   * die between this check and the worker running.
   */
  fastify.post('/push', { schema: { tags: TAGS, body: SendPushBody } }, async (request, reply) => {
    const { userId, idempotencyKey, ...text } = request.body;

    if (!messaging) return reply.code(503).sendError('push_disabled');

    const [client] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!client) return reply.code(404).sendError('not_found');

    const deviceCount = await countPushableDevicesForUser(userId);
    if (deviceCount === 0) return reply.code(409).sendError('no_push_devices');

    const adminId = +(request.user as { sub: string }).sub;
    const created = await sendCustomPush({
      userIds: [userId],
      text: {
        titleRu: text.titleRu.trim(),
        titleUz: text.titleUz.trim(),
        bodyRu: text.bodyRu.trim(),
        bodyUz: text.bodyUz.trim(),
      },
      sentByAdminId: adminId,
      idempotencyKey,
    });

    // Empty → every row collided on its dedupeKey, i.e. this exact request was
    // already served. Idempotent replay, not an error: report the same shape.
    return reply.code(created.length ? 201 : 200).send({
      notificationId: created[0] ?? null,
      deviceCount,
      duplicate: created.length === 0,
    });
  });
}
