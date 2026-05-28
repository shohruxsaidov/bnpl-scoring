import { eq } from "drizzle-orm"
import type { Db } from "../../../db"
import { merchantUsers } from "../../id/db/schema"
import { hashPassword } from "../../auth/admin/service"

export async function listEmployees(db: Db, branchId: bigint) {
  return db
    .select({
      id: merchantUsers.id,
      email: merchantUsers.email,
      fullName: merchantUsers.fullName,
      merchantId: merchantUsers.merchantId,
      branchId: merchantUsers.branchId,
      roles: merchantUsers.roles,
      mustChangePassword: merchantUsers.mustChangePassword,
      active: merchantUsers.active,
      createdAt: merchantUsers.createdAt,
    })
    .from(merchantUsers)
    .where(eq(merchantUsers.branchId, branchId))
    .orderBy(merchantUsers.createdAt)
}

export async function listEmployeesByMerchant(db: Db, merchantId: bigint) {
  return db
    .select({
      id: merchantUsers.id,
      fullName: merchantUsers.fullName,
      email: merchantUsers.email,
      roles: merchantUsers.roles,
      active: merchantUsers.active,
    })
    .from(merchantUsers)
    .where(eq(merchantUsers.merchantId, merchantId))
    .orderBy(merchantUsers.fullName)
}

export async function getEmployee(db: Db, id: bigint) {
  const [row] = await db
    .select({
      id: merchantUsers.id,
      email: merchantUsers.email,
      fullName: merchantUsers.fullName,
      merchantId: merchantUsers.merchantId,
      branchId: merchantUsers.branchId,
      roles: merchantUsers.roles,
      mustChangePassword: merchantUsers.mustChangePassword,
      active: merchantUsers.active,
      createdAt: merchantUsers.createdAt,
    })
    .from(merchantUsers)
    .where(eq(merchantUsers.id, id))
    .limit(1)
  return row
}

export async function createEmployee(
  db: Db,
  input: {
    email: string
    password: string
    fullName: string
    merchantId: bigint
    branchId: bigint
    roles: string[]
  },
) {
  const passwordHash = await hashPassword(input.password)
  const [row] = await db
    .insert(merchantUsers)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName,
      merchantId: input.merchantId,
      branchId: input.branchId,
      roles: input.roles,
      mustChangePassword: true,
    })
    .returning({
      id: merchantUsers.id,
      email: merchantUsers.email,
      fullName: merchantUsers.fullName,
      merchantId: merchantUsers.merchantId,
      branchId: merchantUsers.branchId,
      roles: merchantUsers.roles,
      mustChangePassword: merchantUsers.mustChangePassword,
      active: merchantUsers.active,
      createdAt: merchantUsers.createdAt,
    })
  return row!
}

export async function updateEmployee(
  db: Db,
  id: bigint,
  input: Partial<{ fullName: string; roles: string[]; active: boolean }>,
) {
  const [row] = await db
    .update(merchantUsers)
    .set(input)
    .where(eq(merchantUsers.id, id))
    .returning({
      id: merchantUsers.id,
      email: merchantUsers.email,
      fullName: merchantUsers.fullName,
      merchantId: merchantUsers.merchantId,
      branchId: merchantUsers.branchId,
      roles: merchantUsers.roles,
      mustChangePassword: merchantUsers.mustChangePassword,
      active: merchantUsers.active,
      createdAt: merchantUsers.createdAt,
    })
  return row
}
