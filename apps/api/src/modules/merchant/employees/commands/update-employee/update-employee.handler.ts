import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { merchantUsers } from '@db/schema';

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
};

export async function updateEmployee(
  id: number,
  merchantId: number,
  input: Partial<{ fullName: string; branchId: number; roles: string[]; active: boolean }>,
) {
  const [row] = await db
    .update(merchantUsers)
    .set(input)
    .where(and(eq(merchantUsers.id, id), eq(merchantUsers.merchantId, merchantId)))
    .returning(safeSelect);
  return row;
}
