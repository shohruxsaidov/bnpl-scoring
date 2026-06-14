import type { getMerchant } from "./queries/get-merchant"
import type { createBranch } from "../branches/commands/create-branch"
import type { listEnabledCategories } from "../categories/queries/list-enabled-categories"
import type { createProduct } from "../products/commands/create-product"
import type { recordDocument } from "./commands/record-document"

export function serializeMerchant(m: NonNullable<Awaited<ReturnType<typeof getMerchant>>>) {
  return { ...m, id: m.id.toString() }
}

export function serializeBranch(b: Awaited<ReturnType<typeof createBranch>>) {
  return { ...b, id: b.id.toString(), merchantId: b.merchantId.toString() }
}

export function serializeCategory(c: Awaited<ReturnType<typeof listEnabledCategories>>[number]) {
  return { ...c, id: c.id.toString() }
}

export function serializeProduct(p: Awaited<ReturnType<typeof createProduct>>) {
  return { ...p, id: p.id.toString(), merchantId: p.merchantId.toString(), categoryId: p.categoryId.toString() }
}

export function serializeDocument(d: Awaited<ReturnType<typeof recordDocument>>) {
  return {
    ...d,
    id: d.id.toString(),
    merchantId: d.merchantId.toString(),
    uploadedByAdminId: d.uploadedByAdminId?.toString() ?? null,
  }
}
