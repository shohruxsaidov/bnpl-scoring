import type { FastifyInstance } from "fastify"
import merchantClientRoutes from "./client/routes"
import merchantCatalogRoutes from "./catalog/routes"
import merchantBranchRoutes from "./branches/routes"
import merchantEmployeeRoutes from "./employees/routes"
import merchantTariffRoutes from "./tariffs/routes"
import mxikRoutes from "../mxik/routes"

export default async function merchantModule(app: FastifyInstance) {
  await app.register(merchantClientRoutes, { prefix: "/merchant/client" })
  await app.register(merchantCatalogRoutes, { prefix: "/merchant/catalog" })
  await app.register(merchantBranchRoutes, { prefix: "/merchant/branches" })
  await app.register(merchantEmployeeRoutes, { prefix: "/merchant/employees" })
  await app.register(merchantTariffRoutes, { prefix: "/merchant/tariffs" })
  await app.register(mxikRoutes, { prefix: "/merchant/mxik", preHandler: app.verifyMerchantJwt })
}
