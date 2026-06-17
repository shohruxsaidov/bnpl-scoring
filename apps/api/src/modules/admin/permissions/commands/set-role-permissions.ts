import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { rolePermissions } from "../../../id/db/schema"

export async function setRolePermissions(db: Db, roleId: number, features: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
    if (features.length > 0) {
      await tx.insert(rolePermissions).values(features.map((feature) => ({ roleId, feature })))
    }
  })
}
