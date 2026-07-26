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
import adminNotificationsRoutes from "./notifications/index"
import adminAppRatingRoutes from "./appRatings/index"
import adminBannerRoutes from "./banners/index"
import mxikRoutes from "../mxik/index"
import adminBankRoutes from "./banks/index"
import adminOrganizationRoutes from "./organization/index"
import adminScoringModelRoutes from "./scoringModel/index"
import adminScoringSettingsRoutes from "./scoringSettings/index"
import adminScoringRoutes from "./scorings/index"
import adminIntegrationLogRoutes from "./integrationLogs/index"
import adminPublicOfferRoutes from "./publicOffers/index"
import adminAppVersionRoutes from "./appVersions/index"
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
  // Read-only by design: requirePermissionByMethod skips the check when no
  // `write` feature is mapped, so a POST added here would be reachable by any
  // admin holding read-only view_clients. Client mutations belong in their own
  // guarded module — see /admin/notifications.
  await app.register(guarded(adminClientsRoutes, { read: "view_clients" }), { prefix: "/admin/clients" })
  await app.register(guarded(adminNotificationsRoutes, { read: "send_client_push", write: "send_client_push" }), { prefix: "/admin/notifications" })
  // Read-only by design, same trap as /admin/clients above: requirePermissionByMethod
  // skips the check entirely when no `write` feature is mapped, so a POST added
  // here would be reachable by any admin holding read-only view_app_ratings.
  // Ratings are written by clients via /client/ratings and by nobody else.
  await app.register(guarded(adminAppRatingRoutes, { read: "view_app_ratings" }), { prefix: "/admin/app-ratings" })
  await app.register(guarded(adminBannerRoutes, { read: "manage_banners", write: "manage_banners" }), { prefix: "/admin/banners" })
  await app.register(guarded(adminUsersRoutes, { read: "manage_admins", write: "manage_admins" }), { prefix: "/admin/users" })
  await app.register(adminPermissionsRoutes, { prefix: "/admin/permissions" })
  await app.register(mxikRoutes, { prefix: "/admin/mxik", preHandler: app.verifyAdminJwt })
  await app.register(adminBankRoutes, { prefix: "/admin/banks" })
  await app.register(guarded(adminOrganizationRoutes, { read: "manage_settings", write: "manage_settings" }), { prefix: "/admin/organization" })
  await app.register(guarded(adminPublicOfferRoutes, { read: "manage_settings", write: "manage_settings" }), { prefix: "/admin/public-offers" })
  // Gated by its own features, not manage_settings: publishing a policy can lock
  // every client out of the app at once, which should not ride along with the
  // org-requisites / public-offer grant. Read is split from write so support can
  // see the floor and the blast-radius preview during an incident without being
  // able to move it — the two are checked independently, so a role that publishes
  // needs BOTH grants. `write` must stay mapped: requirePermissionByMethod skips
  // the check entirely when it is absent, which would leave POST open to any
  // holder of read-only view_app_versions.
  await app.register(guarded(adminAppVersionRoutes, { read: "view_app_versions", write: "manage_app_versions" }), { prefix: "/admin/app-versions" })
  await app.register(guarded(adminScoringModelRoutes, { read: "manage_scoring_model", write: "manage_scoring_model" }), { prefix: "/admin/scoring-model" })
  // Gated by manage_scoring_model, not manage_settings: disabling a pipeline can
  // weaken platform-wide risk controls, so it belongs with model authoring rather
  // than with the org-requisites / public-offer grant. `write` must stay mapped —
  // requirePermissionByMethod skips the check entirely when it is absent.
  await app.register(guarded(adminScoringSettingsRoutes, { read: "manage_scoring_model", write: "manage_scoring_model" }), { prefix: "/admin/scoring-settings" })
  await app.register(guarded(adminScoringRoutes, { read: "view_scorings" }), { prefix: "/admin/scorings" })
  await app.register(guarded(adminIntegrationLogRoutes, { read: "view_integration_logs" }), { prefix: "/admin/integration-logs" })
  await app.register(regionRoutes, { prefix: "/admin/regions", preHandler: app.verifyAdminJwt })
}
