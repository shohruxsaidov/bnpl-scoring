import type { FastifyInstance } from "fastify"
import adminMerchantRoutes from "./merchants/routes"
import adminBranchRoutes from "./branches/routes"
import adminEmployeeRoutes from "./employees/routes"
import adminCategoryRoutes from "./categories/routes"
import adminProductRoutes from "./products/routes"
import adminTariffRoutes from "./tariffs/routes"
import adminBlacklistRoutes from "./blacklist/routes"
import adminNotificationRoutes from "./notifications/routes"
import adminDealRoutes from "./deals/routes"
import mxikRoutes from "../mxik/routes"

export default async function adminModule(app: FastifyInstance) {
  await app.register(adminMerchantRoutes, { prefix: "/admin/merchants" })
  await app.register(adminBranchRoutes, { prefix: "/admin/branches" })
  await app.register(adminEmployeeRoutes, { prefix: "/admin/employees" })
  await app.register(adminCategoryRoutes, { prefix: "/admin/categories" })
  await app.register(adminProductRoutes, { prefix: "/admin/products" })
  await app.register(adminTariffRoutes, { prefix: "/admin/tariffs" })
  await app.register(adminBlacklistRoutes, { prefix: "/admin/blacklist" })
  await app.register(adminNotificationRoutes, { prefix: "/admin/notifications" })
  await app.register(adminDealRoutes, { prefix: "/admin/deals" })
  await app.register(mxikRoutes, { prefix: "/admin/mxik", preHandler: app.verifyAdminJwt })
}
