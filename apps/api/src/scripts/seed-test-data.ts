import 'dotenv/config';
import { and, eq, inArray, sql, ilike } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  adminUsers,
  branches,
  categories,
  merchants,
  merchantUsers,
  products,
  rolePermissions,
  roles,
  tariffs,
} from '@db/schema';
import { hashPassword } from '../modules/auth/admin/service/service.handler';
import { MERCHANT_FEATURES } from '../rbac/features';

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

async function main() {
  const roleIds = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(sql`${roles.name} in ('merchant_admin', 'agent')`);

  const [merchant] = await db
    .insert(merchants)
    .values({
      address: 'Toshkent sh',
      inn: '123456789',
      legalName: 'Technouz',
      name: 'Technouz',
      phone: '998934244724',
      accountNumber: '123456789012345',
    })
    .returning();

  const [branch] = await db
    .insert(branches)
    .values({
      merchantId: merchant.id,
      address: 'Toshkent sh',
      name: 'Technouz',
      phone: '998934244724',
    })
    .returning();

  await db.insert(merchantUsers).values({
    branchId: branch.id,
    fullName: 'Abrorbek',
    merchantId: merchant.id,
    phone: '998934244724',
    roles: roleIds.map((item) => `${item.id}`),
    passwordHash: await hashPassword('12345678'),
  });

  // Tariff

  await db.insert(tariffs).values({
    markupPercent: '10',
    name: '10%',
    termMonths: 3,
  });

  // Categories

  const [category] = await db
    .insert(categories)
    .values({
      name: 'Telefonlar',
    })
    .returning();

  await db.insert(products).values({
    name: 'Iphone13',
    categoryId: category.id,
    merchantId: merchant.id,
    price: '1000000',
  });

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
