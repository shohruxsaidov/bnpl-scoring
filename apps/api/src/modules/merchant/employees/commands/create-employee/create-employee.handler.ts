import { db } from '@db';
import { merchantUsers } from '@db/schema';
import { hashPassword } from '../../../../auth/admin/service/service.handler';
import type { CreateEmployeeCommand } from './create-employee.command';

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

export async function createEmployee(input: CreateEmployeeCommand) {
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(merchantUsers)
    .values({ ...input, passwordHash, mustChangePassword: true })
    .returning(safeSelect);
  return row!;
}
