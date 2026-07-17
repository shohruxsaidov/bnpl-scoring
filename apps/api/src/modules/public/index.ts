import type { FastifyInstance } from 'fastify';
import publicOfferRoutes from './offer/index';
import publicAppVersionRoutes from './app-version/index';
import publicMerchantLogoRoutes from './merchant-logo/index';
import publicUserPhotos from './user-photo';

// Unauthenticated, public-facing endpoints (no session, no x-device-id).
export default async function publicModule(app: FastifyInstance) {
  await app.register(publicOfferRoutes);
  await app.register(publicAppVersionRoutes);
  await app.register(publicMerchantLogoRoutes);
  await app.register(publicUserPhotos);
}
