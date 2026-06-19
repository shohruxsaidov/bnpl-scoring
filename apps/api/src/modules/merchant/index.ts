import type { FastifyInstance } from 'fastify';
import merchantClientRoutes from './client/index';
import merchantCatalogRoutes from './catalog/index';
import merchantBranchRoutes from './branches/index';
import merchantEmployeeRoutes from './employees/index';
import merchantTariffRoutes from './tariffs/index';
import merchantDealRoutes from './deals/index';
import merchantDealSessionRoutes from './deal-sessions/index';
import merchantScoringHistoryRoutes from './scoringHistory/index';
import mxikRoutes from '../mxik/index';
import regionRoutes from '../regions/index';

export default async function merchantModule(app: FastifyInstance) {
  await app.register(merchantClientRoutes, { prefix: '/merchant/client' });
  await app.register(merchantCatalogRoutes, { prefix: '/merchant/catalog' });
  await app.register(merchantBranchRoutes, { prefix: '/merchant/branches' });
  await app.register(merchantEmployeeRoutes, { prefix: '/merchant/employees' });
  await app.register(merchantTariffRoutes, { prefix: '/merchant/tariffs' });
  await app.register(merchantDealRoutes, { prefix: '/merchant/deals' });
  await app.register(merchantDealSessionRoutes, { prefix: '/merchant/deal-sessions' });
  await app.register(merchantScoringHistoryRoutes, { prefix: '/merchant/scoring-history' });
  await app.register(mxikRoutes, { prefix: '/merchant/mxik', preHandler: app.verifyMerchantJwt });
  await app.register(regionRoutes, {
    prefix: '/merchant/regions',
    preHandler: app.verifyMerchantJwt,
  });
}
