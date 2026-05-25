import type { FastifyInstance } from "fastify"
import adminMerchantRoutes from "./merchants/routes"
import adminBranchRoutes from "./branches/routes"
import adminEmployeeRoutes from "./employees/routes"
import adminCategoryRoutes from "./categories/routes"
import adminProductRoutes from "./products/routes"

export default async function adminModule(app: FastifyInstance) {
  await app.register(adminMerchantRoutes, { prefix: "/admin/merchants" })
  await app.register(adminBranchRoutes, { prefix: "/admin/branches" })
  await app.register(adminEmployeeRoutes, { prefix: "/admin/employees" })
  await app.register(adminCategoryRoutes, { prefix: "/admin/categories" })
  await app.register(adminProductRoutes, { prefix: "/admin/products" })
}
