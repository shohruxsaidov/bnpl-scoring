import type { FastifyInstance } from 'fastify';
import merchantAuthRoutes from './merchant/index';
import adminAuthRoutes from './admin/index';

export default async function authModule(app: FastifyInstance) {
  await app.register(merchantAuthRoutes, { prefix: '/auth/merchant' });
  await app.register(adminAuthRoutes, { prefix: '/auth/admin' });
}
