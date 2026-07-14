import type { FastifyInstance } from 'fastify';

export default async function autoPayModule(app: FastifyInstance) {
  app.post('/', async (req, res) => {
    console.log(req.body);
    return { status: 'ok' };
  });
}
