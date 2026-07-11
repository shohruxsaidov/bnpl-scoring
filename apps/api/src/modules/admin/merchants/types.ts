import type { getMerchant } from "./queries/get-merchant/get-merchant.handler"
import type { createBranch } from "../branches/commands/create-branch/create-branch.handler"
import type { listEnabledCategories } from "../categories/queries/list-enabled-categories/list-enabled-categories.handler"
import type { createProduct } from "../products/commands/create-product/create-product.handler"
import type { recordDocument } from "./commands/record-document/record-document.handler"
import { buildMerchantLogoUrl } from "../../../lib/merchant-logo"

// logoFileId is an internal handle; clients get the derived URL instead, so it is
// dropped here rather than leaked alongside it.
export function serializeMerchant(m: NonNullable<Awaited<ReturnType<typeof getMerchant>>>) {
  const { logoFileId, ...rest } = m
  return { ...rest, id: m.id.toString(), logoUrl: buildMerchantLogoUrl(m.id, logoFileId) }
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
