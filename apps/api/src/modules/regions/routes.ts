import type { FastifyInstance } from 'fastify';
import { eq, isNull } from 'drizzle-orm';
import { regions } from '../id/db/schema';

export default async function regionRoutes(app: FastifyInstance) {
  const db = app.db;

  // GET /regions            → top-level Regions (oblasts)
  // GET /regions?upperId=N  → Districts under Region N
  // GET /regions?flat=true  → all rows (used for name lookups)
  app.get('/', async (req) => {
    const { upperId, flat } = req.query as { upperId?: string; flat?: string };

    if (flat === 'true') {
      return db.select().from(regions).orderBy(regions.nameRu);
    }

    if (upperId !== undefined) {
      const parentId = parseInt(upperId, 10);
      return db
        .select()
        .from(regions)
        .where(eq(regions.upperId, parentId))
        .orderBy(regions.nameRu);
    }

    return db
      .select()
      .from(regions)
      .where(isNull(regions.upperId))
      .orderBy(regions.nameRu);
  });
}
