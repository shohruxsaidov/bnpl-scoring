import type { getMerchant } from "./queries/get-merchant/get-merchant.handler"
import type { createBranch } from "../branches/commands/create-branch/create-branch.handler"
import type { listEnabledCategories } from "../categories/queries/list-enabled-categories/list-enabled-categories.handler"
import type { createProduct } from "../products/commands/create-product/create-product.handler"
import type { recordDocument } from "./commands/record-document/record-document.handler"
import { db } from '@db'
import { getDownloadUrls } from "../../../lib/file-storage"

type MerchantRow = NonNullable<Awaited<ReturnType<typeof getMerchant>>>

// The admin portal loads logos straight from object storage, so logoUrl is a
// presigned MinIO GET rather than the public streaming endpoint the mobile app
// uses (see lib/merchant-logo). It expires, which is fine here: the portal only
// ever renders a URL it just fetched alongside the merchant.
//
// logoFileId is an internal handle; the URL replaces it rather than shipping
// alongside it.
export async function serializeMerchants(rows: MerchantRow[]) {
  const logoUrls = await getDownloadUrls(
    db,
    rows.map((r) => r.logoFileId).filter((id): id is number => id != null),
  )
  return rows.map(({ logoFileId, ...rest }) => ({
    ...rest,
    id: rest.id.toString(),
    logoUrl: logoFileId == null ? null : (logoUrls.get(logoFileId) ?? null),
  }))
}

export async function serializeMerchant(m: MerchantRow) {
  const [serialized] = await serializeMerchants([m])
  return serialized!
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
