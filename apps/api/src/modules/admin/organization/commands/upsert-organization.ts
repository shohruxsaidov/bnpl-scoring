import { sql } from "drizzle-orm"
import type { Db } from "../../../../db"
import { organization } from "../db/schema"

export interface OrganizationInput {
  name: string
  legalName: string
  address: string
  phone: string
  inn: string
  mfo: string
  accountNumber: string
  bankName: string
}

export async function upsertOrganization(db: Db, input: OrganizationInput) {
  const [row] = await db
    .insert(organization)
    .values({ id: 1, ...input })
    .onConflictDoUpdate({
      target: organization.id,
      set: { ...input, updatedAt: sql`now()` },
    })
    .returning()
  return row
}
