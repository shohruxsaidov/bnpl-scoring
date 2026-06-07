import { eq, and, inArray } from "drizzle-orm"
import type { Db } from "../../../db"
import { merchantUsers, branches } from "../../id/db/schema"
import { hashPassword } from "../../auth/admin/service"

const safeSelect = {
  id: merchantUsers.id,
  phone: merchantUsers.phone,
  fullName: merchantUsers.fullName,
  merchantId: merchantUsers.merchantId,
  branchId: merchantUsers.branchId,
  roles: merchantUsers.roles,
  mustChangePassword: merchantUsers.mustChangePassword,
  active: merchantUsers.active,
  createdAt: merchantUsers.createdAt,
}

export async function listEmployees(db: Db, merchantId: bigint) {
  return db.select(safeSelect).from(merchantUsers).where(eq(merchantUsers.merchantId, merchantId)).orderBy(merchantUsers.createdAt)
}

export async function createEmployee(
  db: Db,
  input: { phone: string; password: string; fullName: string; merchantId: bigint; branchId: bigint; roles: string[] },
) {
  const passwordHash = await hashPassword(input.password)
  const [row] = await db
    .insert(merchantUsers)
    .values({ ...input, passwordHash, mustChangePassword: true })
    .returning(safeSelect)
  return row!
}

export async function updateEmployee(
  db: Db,
  id: bigint,
  merchantId: bigint,
  input: Partial<{ fullName: string; branchId: bigint; roles: string[]; active: boolean }>,
) {
  const [row] = await db
    .update(merchantUsers)
    .set(input)
    .where(and(eq(merchantUsers.id, id), eq(merchantUsers.merchantId, merchantId)))
    .returning(safeSelect)
  return row
}
