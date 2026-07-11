import type { FastifyInstance } from 'fastify';
import publicOfferRoutes from './offer/index';
import publicMerchantLogoRoutes from './merchant-logo/index';

// Unauthenticated, public-facing endpoints (no session, no x-device-id).
export default async function publicModule(app: FastifyInstance) {
  await app.register(publicOfferRoutes);
  await app.register(publicMerchantLogoRoutes);
}
