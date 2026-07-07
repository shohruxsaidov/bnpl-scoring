import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
  toNotificationDto,
} from './service';

// Client (mobile) notification inbox. Rows are written by notify() (source of
// truth) and mirrored as FCM pushes. Content is data-driven — the app renders
// localized text from `type` + `data`. Authenticated by the client JWT; user id
// comes from request.user.sub. Inherits the module's x-device-id requirement.

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

const NotificationItem = Type.Object(
  {
    id: Type.String(),
    type: Type.String(),
    data: Type.Record(Type.String(), Type.Unknown()),
    readAt: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
  },
  {
    examples: [
      {
        id: 'a3f1c2b4-5d6e-7f80-9a1b-2c3d4e5f6071',
        type: 'scoring_approved',
        data: { creditLimit: '5000000' },
        readAt: null,
        createdAt: '2026-07-07T10:12:00.000Z',
      },
    ],
  },
);

export default async function clientNotificationsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Notifications'];
  const guards = [app.verifyClientJwt];

  const IdParams = Type.Object({
    id: Type.String({ format: 'uuid', examples: ['a3f1c2b4-5d6e-7f80-9a1b-2c3d4e5f6071'] }),
  });
  const Ok = Type.Object({ ok: Type.Boolean() }, { examples: [{ ok: true }] });

  /* ── GET /client/notifications — inbox (newest first) + unread count ────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List notifications',
        description:
          "Returns the authenticated client's notifications, newest first, with the " +
          'current unread count in the response.',
        security: SECURITY,
        querystring: Type.Object({
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
          offset: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
        response: {
          200: Type.Object({
            notifications: Type.Array(NotificationItem),
            unreadCount: Type.Integer(),
          }),
          401: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request) => {
      const userId = Number(request.user.sub);
      const limit = request.query.limit ?? 25;
      const offset = request.query.offset ?? 0;
      const [rows, unreadCount] = await Promise.all([
        listNotifications(userId, limit, offset),
        countUnread(userId),
      ]);
      return { notifications: rows.map(toNotificationDto), unreadCount };
    },
  );

  /* ── POST /client/notifications/:id/read — mark one read (idempotent) ───── */

  fastify.post(
    '/:id/read',
    {
      schema: {
        tags: TAGS,
        summary: 'Mark notification read',
        description: 'Marks one notification read. Idempotent. 404 if not the caller’s.',
        security: SECURITY,
        params: IdParams,
        response: { 200: Ok, 401: ERROR, 404: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const ok = await markRead(userId, request.params.id);
      if (!ok) return reply.code(404).sendError('notification_not_found');
      return { ok: true };
    },
  );

  /* ── POST /client/notifications/read-all — mark all read ────────────────── */

  fastify.post(
    '/read-all',
    {
      schema: {
        tags: TAGS,
        summary: 'Mark all read',
        description: "Marks all of the caller's unread notifications read.",
        security: SECURITY,
        response: { 200: Ok, 401: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      await markAllRead(Number(request.user.sub));
      return { ok: true };
    },
  );
}
