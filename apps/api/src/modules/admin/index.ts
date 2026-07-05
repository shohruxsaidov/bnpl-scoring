import type { FastifyInstance, FastifyPluginAsync } from "fastify"
import adminOverviewRoutes from "./overview/index"
import adminMerchantRoutes from "./merchants/index"
import adminBranchRoutes from "./branches/index"
import adminEmployeeRoutes from "./employees/index"
import adminCategoryRoutes from "./categories/index"
import adminProductRoutes from "./products/index"
import adminTariffRoutes from "./tariffs/index"
import adminBlacklistRoutes from "./blacklist/index"
import adminDealRoutes from "./deals/index"
import adminUsersRoutes from "./users/index"
import adminPermissionsRoutes from "./permissions/index"
import adminPaymentRoutes from "./payments/index"
import adminCollectionBoardRoutes from "./collectionBoard/index"
import adminBuyoutRoutes from "./buyouts/index"
import adminClientsRoutes from "./clients/index"
import mxikRoutes from "../mxik/index"
import adminBankRoutes from "./banks/index"
import adminOrganizationRoutes from "./organization/index"
import adminScoringModelRoutes from "./scoringModel/index"
import adminScoringRoutes from "./scorings/index"
import adminIntegrationLogRoutes from "./integrationLogs/index"
import adminPublicOfferRoutes from "./publicOffers/index"
import regionRoutes from "../regions/index"

interface FeatureMap {
  read?: string
  write?: string
}

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
  await app.register(guarded(adminCategoryRoutes, { read: "manage_global_categories", write: "manage_global_categories" }), { prefix: "/admin/categories" })
  await app.register(guarded(adminProductRoutes, { read: "manage_products", write: "manage_products" }), { prefix: "/admin/products" })
  await app.register(guarded(adminTariffRoutes, { read: "view_tariffs", write: "manage_tariffs" }), { prefix: "/admin/tariffs" })
  await app.register(guarded(adminBlacklistRoutes, { read: "manage_blacklist", write: "manage_blacklist" }), { prefix: "/admin/blacklist" })
  await app.register(guarded(adminDealRoutes, { read: "view_deals", write: "manage_payments" }), { prefix: "/admin/deals" })
  await app.register(guarded(adminPaymentRoutes, { read: "view_payments", write: "manage_payments" }), { prefix: "/admin/payments" })
  await app.register(guarded(adminCollectionBoardRoutes, { read: "view_collection_board" }), { prefix: "/admin/collection-board" })
  await app.register(guarded(adminBuyoutRoutes, { read: "manage_buyout", write: "manage_buyout" }), { prefix: "/admin/buyouts" })
  await app.register(guarded(adminClientsRoutes, { read: "view_clients" }), { prefix: "/admin/clients" })
  await app.register(guarded(adminUsersRoutes, { read: "manage_admins", write: "manage_admins" }), { prefix: "/admin/users" })
  await app.register(adminPermissionsRoutes, { prefix: "/admin/permissions" })
  await app.register(mxikRoutes, { prefix: "/admin/mxik", preHandler: app.verifyAdminJwt })
  await app.register(adminBankRoutes, { prefix: "/admin/banks" })
  await app.register(guarded(adminOrganizationRoutes, { read: "manage_settings", write: "manage_settings" }), { prefix: "/admin/organization" })
  await app.register(guarded(adminPublicOfferRoutes, { read: "manage_settings", write: "manage_settings" }), { prefix: "/admin/public-offers" })
  await app.register(guarded(adminScoringModelRoutes, { read: "manage_scoring_model", write: "manage_scoring_model" }), { prefix: "/admin/scoring-model" })
  await app.register(guarded(adminScoringRoutes, { read: "view_scorings" }), { prefix: "/admin/scorings" })
  await app.register(guarded(adminIntegrationLogRoutes, { read: "view_integration_logs" }), { prefix: "/admin/integration-logs" })
  await app.register(regionRoutes, { prefix: "/admin/regions", preHandler: app.verifyAdminJwt })
}
