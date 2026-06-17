import { eq } from "drizzle-orm"
import { db } from "@db"
import { rolePermissions } from '@db/schema'

export async function setRolePermissions(roleId: number, features: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
    if (features.length > 0) {
      await tx.insert(rolePermissions).values(features.map((feature) => ({ roleId, feature })))
    }
  })
}
