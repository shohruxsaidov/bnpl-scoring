import type { Db } from '../../../../db';
import { merchantUsers } from '@db/schema';
import { hashPassword } from '../../../auth/admin/service';

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

export async function createEmployee(
  db: Db,
  input: {
    phone: string;
    password: string;
    fullName: string;
    merchantId: number;
    branchId: number;
    roles: string[];
  },
) {
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(merchantUsers)
    .values({ ...input, passwordHash, mustChangePassword: true })
    .returning(safeSelect);
  return row!;
}
