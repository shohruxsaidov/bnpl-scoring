import type { FastifyInstance } from 'fastify';
import merchantAuthRoutes from './merchant/routes.js';
import adminAuthRoutes from './admin/routes.js';

export default async function authModule(app: FastifyInstance) {
  await app.register(merchantAuthRoutes, { prefix: '/auth/merchant' });
  await app.register(adminAuthRoutes, { prefix: '/auth/admin' });
}
