import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { resolveLang } from '../../../i18n/index';
import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
  toNotificationDto,
} from './service';

// Client (mobile) notification inbox. Rows are written by notify() (source of
// truth) and mirrored as FCM pushes. Rows stay data-driven in the database
// (`type` + `data`); the server renders `title`/`body` on read, in the request's
// `x-lang` — so the app carries no notification strings and an inbox re-fetched
// after a language switch comes back fully translated, however old the rows are.
// The push mirrors the same text via the DEVICE language (there is no request at
// send time), so a push and its inbox row can differ in language — by design.
// Authenticated by the client JWT; user id comes from request.user.sub. Inherits
// the module's x-device-id requirement.

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

const NotificationItem = Type.Object(
  {
    id: Type.String(),
    type: Type.String(),
    data: Type.Record(Type.String(), Type.Unknown()),
    title: Type.String(),
    body: Type.String(),
    readAt: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
  },
  {
    examples: [
      {
        id: 'a3f1c2b4-5d6e-7f80-9a1b-2c3d4e5f6071',
        type: 'scoring_approved',
        data: { creditLimit: '5000000' },
        title: 'Скоринг одобрен',
        body: 'Вам одобрен кредитный лимит 5000000 сум.',
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
      const lang = resolveLang(request.headers['x-lang'] as string | undefined);
      const [rows, unreadCount] = await Promise.all([
        listNotifications(userId, limit, offset),
        countUnread(userId),
      ]);
      const items = rows.map((row) =>
        toNotificationDto(row, lang, (reason) =>
          request.log.warn({ notificationId: row.id, type: row.type, lang }, reason),
        ),
      );
      return { notifications: items, unreadCount };
    },
  );

  /* ── POST /client/notifications/:id/read — mark one read (idempotent) ───── */

  fastify.post(
    '/:id/read',
    {
      schema: {
        tags: TAGS,
        summary: 'Mark notification read',
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
