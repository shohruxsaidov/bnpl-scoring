import { db } from '@db';
import { merchantUsers } from '@db/schema';
import { hashPassword } from '../../../../auth/admin/service';
import { CreateEmployeeCommand } from './create-employee.command';

export async function createEmployee(input: CreateEmployeeCommand) {
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(merchantUsers)
    .values({
      phone: input.phone,
      passwordHash,
      fullName: input.fullName,
      merchantId: input.merchantId,
      branchId: input.branchId,
      roles: input.roles,
      mustChangePassword: true,
    })
    .returning({
      id: merchantUsers.id,
      phone: merchantUsers.phone,
      fullName: merchantUsers.fullName,
      merchantId: merchantUsers.merchantId,
      branchId: merchantUsers.branchId,
      roles: merchantUsers.roles,
      mustChangePassword: merchantUsers.mustChangePassword,
      active: merchantUsers.active,
      createdAt: merchantUsers.createdAt,
    });
  return row!;
}
