import type { FastifyInstance } from 'fastify';
import { eq, isNull } from 'drizzle-orm';
import { regions } from '../id/db/schema';

export default async function regionRoutes(app: FastifyInstance) {
  const db = app.db;

  // GET /regions            → top-level Regions (oblasts)
  // GET /regions?upperId=N  → Districts under Region N
  app.get('/', async (req) => {
    const { upperId } = req.query as { upperId?: string };

    if (upperId !== undefined) {
      const parentId = parseInt(upperId, 10);
      const rows = await db
        .select()
        .from(regions)
        .where(eq(regions.upperId, parentId))
        .orderBy(regions.nameRu);
      return rows;
    }

    const rows = await db
      .select()
      .from(regions)
      .where(isNull(regions.upperId))
      .orderBy(regions.nameRu);
    return rows;
  });
}
