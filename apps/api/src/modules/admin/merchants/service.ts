import { eq } from "drizzle-orm"
import type { Db } from "../../../db"
import { merchants, merchantDocuments } from "../../id/db/schema"

export async function listMerchants(db: Db) {
  return db.select().from(merchants).orderBy(merchants.createdAt)
}

export async function getMerchant(db: Db, id: bigint) {
  const [row] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1)
  return row
}

export async function createMerchant(
  db: Db,
  input: {
    name: string
    legalName: string
    inn: string
    phone: string
    address: string
    logoUrl?: string
    contractNumber?: string
  },
) {
  const [row] = await db.insert(merchants).values(input).returning()
  return row!
}

export async function updateMerchant(
  db: Db,
  id: bigint,
  input: Partial<{
    name: string
    legalName: string
    inn: string
    phone: string
    address: string
    logoUrl: string
    contractNumber: string
    active: boolean
    mfo: string
    accountNumber: string
    bankName: string
  }>,
) {
  const [row] = await db.update(merchants).set(input).where(eq(merchants.id, id)).returning()
  return row
}

export async function listDocuments(db: Db, merchantId: bigint) {
  return db
    .select()
    .from(merchantDocuments)
    .where(eq(merchantDocuments.merchantId, merchantId))
    .orderBy(merchantDocuments.uploadedAt)
}

export async function recordDocument(
  db: Db,
  input: {
    merchantId: bigint
    fileUrl: string
    documentType: string
    uploadedByAdminId: bigint
  },
) {
  const [row] = await db.insert(merchantDocuments).values(input).returning()
  return row!
}
