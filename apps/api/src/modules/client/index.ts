import type { FastifyInstance } from 'fastify';
import clientRegistrationRoutes from './registration/index';
import clientAuthRoutes from './auth/index';
import clientCardsRoutes from './cards/index';
import clientMeRoutes from './me/index';
import clientScoringRoutes from './scoring/index';
import clientNotificationsRoutes from './notifications/index';
import clientDealsRoutes from './deals/index';
import clientDealSigningRoutes from './deals/signing';
import clientScoringCardsRoutes from './scoring/cards';
import clientMerchantsRoutes from './merchants/index';
import clientBannersRoutes from './banners/index';
import clientPaymentsRoutes from './payments/index';
import clientPaymentsByDealRoutes from './payments/by-deal';

declare module 'fastify' {
  interface FastifyRequest {
    // Mobile device identifier from the x-device-id header. Required on every
    // client endpoint (enforced below); null only before the hook runs.
    deviceId: string | null;
  }
}

// Accepts UUIDs and platform vendor ids (iOS identifierForVendor, Android id);
// width mirrors user_devices.device_id varchar(255).
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;

export default async function clientModule(app: FastifyInstance) {
  // All client endpoints must carry x-device-id. Enforced at the module scope so
  // current and future client routes inherit it without per-route wiring.
  app.decorateRequest('deviceId', null);

  app.addHook('onRequest', async (request, reply) => {
    // CORS preflight / probes never carry the header.
    if (request.method === 'OPTIONS' || request.method === 'HEAD') return;

    const raw = request.headers['x-device-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) return reply.code(400).sendError('missing_device_id');
    if (!DEVICE_ID_PATTERN.test(value)) return reply.code(400).sendError('invalid_device_id');

    request.deviceId = value;
    // Bind deviceId to this request's logs (unredacted — not a secret).
    request.log = request.log.child({ deviceId: value });
  });

  await app.register(clientRegistrationRoutes, { prefix: '/client/registration' });
  await app.register(clientAuthRoutes, { prefix: '/client/auth' });
  await app.register(clientCardsRoutes, { prefix: '/client/cards' });
  await app.register(clientMeRoutes, { prefix: '/client/me' });
  await app.register(clientScoringRoutes, { prefix: '/client/scoring' });
  await app.register(clientScoringCardsRoutes, { prefix: '/client/scoring/cards' });
  await app.register(clientNotificationsRoutes, { prefix: '/client/notifications' });
  await app.register(clientMerchantsRoutes, { prefix: '/client/merchants' });
  await app.register(clientBannersRoutes, { prefix: '/client/banners' });
  await app.register(clientPaymentsRoutes, { prefix: '/client/payments' });
  // Same payments, projected per credit. Its own plugin because it pages over
  // deals rather than payments — see payments/by-deal.ts.
  await app.register(clientPaymentsByDealRoutes, { prefix: '/client/payments-by-deal' });
  await app.register(clientDealsRoutes, { prefix: '/client/deals' });
  // Signing shares the /client/deals prefix but is a different concern: these
  // routes act on a DEAL SESSION the client has been asked to sign, not on a Deal
  // they already hold. Kept in its own plugin so the read-only "my credits" surface
  // stays free of the signing state machine.
  await app.register(clientDealSigningRoutes, { prefix: '/client/deals' });
}
