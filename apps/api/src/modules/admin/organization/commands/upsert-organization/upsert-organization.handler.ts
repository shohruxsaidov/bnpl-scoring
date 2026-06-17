import { sql } from "drizzle-orm"
import { db } from "@db"
import { organization } from "../../schema"
import type { OrganizationInput } from "./upsert-organization.command"

export async function upsertOrganization(input: OrganizationInput) {
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
