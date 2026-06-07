import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import adminOverviewRoutes from "./overview/routes"
import adminMerchantRoutes from "./merchants/routes"
import adminBranchRoutes from "./branches/routes"
import adminEmployeeRoutes from "./employees/routes"
import adminCategoryRoutes from "./categories/routes"
import adminProductRoutes from "./products/routes"
import adminTariffRoutes from "./tariffs/routes"
import adminBlacklistRoutes from "./blacklist/routes"
import adminNotificationRoutes from "./notifications/routes"
import adminDealRoutes from "./deals/routes"
import adminUsersRoutes from "./users/routes"
import adminPermissionsRoutes from "./permissions/routes"
import adminScoringHistoryRoutes from "./scoringHistory/routes"
import adminPaymentRoutes from "./payments/routes"
import adminCollectionBoardRoutes from "./collectionBoard/routes"
import adminBuyoutRoutes from "./buyouts/routes"
import adminClientsRoutes from "./clients/routes"
import mxikRoutes from "../mxik/routes"

interface FeatureMap {
  read?: string
  write?: string
}

// Wraps a route module so every request is authenticated and then checked
// against the module's Feature(s) — read Feature for GET/HEAD, write for the rest.
// This centralizes admin-platform enforcement without touching each route file.
function guarded(routes: FastifyPluginAsync, map: FeatureMap): FastifyPluginAsync {
  return async (scope) => {
    scope.addHook("onRequest", scope.verifyAdminJwt)
    scope.addHook("preHandler", scope.requirePermissionByMethod(map))
    await scope.register(routes)
  }
}

export default async function adminModule(app: FastifyInstance) {
  await app.register(adminOverviewRoutes, { prefix: "/admin/overview", preHandler: app.verifyAdminJwt })
  await app.register(guarded(adminMerchantRoutes, { read: "view_merchants", write: "manage_merchants" }), { prefix: "/admin/merchants" })
  await app.register(guarded(adminBranchRoutes, { read: "view_merchants", write: "manage_merchants" }), { prefix: "/admin/branches" })
  await app.register(guarded(adminEmployeeRoutes, { read: "manage_employees", write: "manage_employees" }), { prefix: "/admin/employees" })
  await app.register(guarded(adminCategoryRoutes, { read: "manage_categories", write: "manage_categories" }), { prefix: "/admin/categories" })
  await app.register(guarded(adminProductRoutes, { read: "manage_products", write: "manage_products" }), { prefix: "/admin/products" })
  await app.register(guarded(adminTariffRoutes, { read: "view_tariffs", write: "manage_tariffs" }), { prefix: "/admin/tariffs" })
  await app.register(guarded(adminBlacklistRoutes, { read: "manage_blacklist", write: "manage_blacklist" }), { prefix: "/admin/blacklist" })
  await app.register(guarded(adminNotificationRoutes, { read: "send_notifications", write: "send_notifications" }), { prefix: "/admin/notifications" })
  await app.register(guarded(adminDealRoutes, { read: "view_deals", write: "manage_payments" }), { prefix: "/admin/deals" })
  await app.register(guarded(adminScoringHistoryRoutes, { read: "view_scoring_history" }), { prefix: "/admin/scoring-history" })
  await app.register(guarded(adminPaymentRoutes, { read: "view_payments", write: "manage_payments" }), { prefix: "/admin/payments" })
  await app.register(guarded(adminCollectionBoardRoutes, { read: "view_collection_board" }), { prefix: "/admin/collection-board" })
  await app.register(guarded(adminBuyoutRoutes, { read: "manage_buyout", write: "manage_buyout" }), { prefix: "/admin/buyouts" })
  await app.register(guarded(adminClientsRoutes, { read: "view_clients" }), { prefix: "/admin/clients" })
  await app.register(guarded(adminUsersRoutes, { read: "manage_admins", write: "manage_admins" }), { prefix: "/admin/users" })
  // Permissions module guards itself with manage_roles per-route.
  await app.register(adminPermissionsRoutes, { prefix: "/admin/permissions" })
  // MXIK reference lookups: any authenticated admin.
  await app.register(mxikRoutes, { prefix: "/admin/mxik", preHandler: app.verifyAdminJwt })
}
