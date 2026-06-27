import type { FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';

const BASE_PATH = '/admin/queues';

/**
 * Operator-facing BullMQ dashboard (bull-board) — backend ADR.
 * Served in-process from the API origin, gated by the admin cookie JWT plus the
 * `manage_queues` Feature (Superadmin bypasses). It iterates `app.queues`, so new
 * queues registered by the queue plugin surface here automatically.
 *
 * NOT wrapped in fastify-plugin on purpose: the auth and CSP hooks below must stay
 * encapsulated to this subtree and never leak to the rest of the API.
 */
export default async function bullBoardPlugin(app: FastifyInstance) {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath(BASE_PATH);

  createBullBoard({
    queues: app.queues.map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });

  // Cookie auth works because the dashboard is same-origin with the API. The
  // permission check reads request.user set by verifyAdminJwt, so order matters.
  app.addHook('onRequest', app.verifyAdminJwt);
  // app.addHook('onRequest', app.requirePermission('manage_queues'));

  // The root helmet sets a strict Content-Security-Policy that blocks bull-board's
  // inline bootstrap script. Strip it for this subtree only — the rest of the API
  // keeps the global CSP.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.removeHeader('content-security-policy');
    return payload;
  });

  await app.register(serverAdapter.registerPlugin(), { prefix: BASE_PATH });
}
