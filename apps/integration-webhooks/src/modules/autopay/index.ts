import type { FastifyInstance } from 'fastify';

export default async function autoPayModule(app: FastifyInstance) {
  app.get('/health', async () => {
    return { status: 'ok' };
  });
}
