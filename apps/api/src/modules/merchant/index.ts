import type { FastifyInstance } from "fastify"
import merchantClientRoutes from "./client/routes"
import merchantCatalogRoutes from "./catalog/routes"
import merchantBranchRoutes from "./branches/routes"
import merchantEmployeeRoutes from "./employees/routes"
import merchantTariffRoutes from "./tariffs/routes"
import merchantCardRoutes from "./cards/routes"
import merchantDealRoutes from "./deals/routes"
import merchantScoringHistoryRoutes from "./scoringHistory/routes"
import collectionBoardRoutes from "./collectionBoard/routes"
import merchantPaymentRoutes from "./payments/routes"
import merchantKatmRoutes from "./katm/routes"
import mxikRoutes from "../mxik/routes"

export default async function merchantModule(app: FastifyInstance) {
  await app.register(merchantClientRoutes, { prefix: "/merchant/client" })
  await app.register(merchantCatalogRoutes, { prefix: "/merchant/catalog" })
  await app.register(merchantBranchRoutes, { prefix: "/merchant/branches" })
  await app.register(merchantEmployeeRoutes, { prefix: "/merchant/employees" })
  await app.register(merchantTariffRoutes, { prefix: "/merchant/tariffs" })
  await app.register(merchantCardRoutes, { prefix: "/merchant/cards" })
  await app.register(merchantDealRoutes, { prefix: "/merchant/deals" })
  await app.register(merchantScoringHistoryRoutes, { prefix: "/merchant/scoring-history" })
  await app.register(collectionBoardRoutes, { prefix: "/merchant/collection-board" })
  await app.register(merchantPaymentRoutes, { prefix: "/merchant/payments" })
  await app.register(merchantKatmRoutes, { prefix: "/merchant/katm" })
  await app.register(mxikRoutes, { prefix: "/merchant/mxik", preHandler: app.verifyMerchantJwt })
}
