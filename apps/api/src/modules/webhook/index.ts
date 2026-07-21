import type { FastifyInstance } from 'fastify';
import { env } from '@env';
import { assertPaymeAuth, isAllowedIp } from '../integrations/payme/auth';
import { PaymeRpcError, paymeErrors } from '../integrations/payme/errors';
import { dispatchPayme } from '../integrations/payme/rpc';

// ---------------------------------------------------------------------------
// Inbound webhooks from payment rails. Nothing here is authenticated the way the
// rest of the API is — no JWT, no session — so each route carries its own lock.
//
// Registered with prefix '/api/v1' only, so paths are spelled in full here.
// ---------------------------------------------------------------------------

export default async function webhookRoutes(app: FastifyInstance) {
  /* ── POST /api/v1/webhook/payme — Payme Merchant API (JSON-RPC 2.0) ──────
   *
   * Every Merchant API method arrives here. Three deviations from house style,
   * all forced by the protocol:
   *
   *   1. ALWAYS HTTP 200. Errors ride in the JSON-RPC body. A 4xx/5xx reads to
   *      Payme as a transport failure and it retries — on a PerformTransaction
   *      that may already have booked money. Hence no body schema (a Fastify
   *      validation 400 would escape the boundary), no sendError, and a
   *      catch-all inside dispatchPayme().
   *   2. rateLimit: false. The global limiter is 100/min per IP and Payme calls
   *      from a small fixed set of addresses, so all merchant traffic shares one
   *      bucket. Throttling Payme produces 429s — non-200 — and retry storms.
   *      PAYME_ALLOWED_IPS replaces it as the flood guard.
   *   3. Auth failures are dispatched, not thrown. An unauthorized call still
   *      has to be answered in protocol shape (-32504) and still has to be
   *      logged, so the error is handed to the dispatcher rather than short-
   *      circuiting the route.
   */
  app.post(
    '/webhook/payme',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['Webhooks'],
        summary: 'Payme Merchant API',
        description:
          'JSON-RPC 2.0 endpoint called by Payme. Basic auth (Paycom:<cashbox key>). ' +
          'Always answers HTTP 200 — outcomes are carried in the JSON-RPC body.',
      },
    },
    async (request, reply) => {
      if (!env.PAYME_ENABLED) {
        // Dark-launch state. Answer in protocol shape so a cashbox misconfigured
        // to point at this environment gets a comprehensible refusal instead of
        // a 404 that looks like an outage.
        return reply.code(200).send(await dispatchPayme(request.body, paymeErrors.unauthorized()));
      }

      let authError: PaymeRpcError | null = null;
      try {
        if (!isAllowedIp(request.ip)) throw paymeErrors.unauthorized();
        assertPaymeAuth(request.headers.authorization);
      } catch (err) {
        authError = err instanceof PaymeRpcError ? err : paymeErrors.unauthorized();
      }

      return reply.code(200).send(await dispatchPayme(request.body, authError));
    },
  );
}
