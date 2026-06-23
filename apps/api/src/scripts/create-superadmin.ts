import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { adminUsers, branches, merchants, merchantUsers, rolePermissions, roles } from '@db/schema';
import { hashPassword } from '../modules/auth/admin/service/service.handler';
import { MERCHANT_FEATURES } from '../rbac/features';

// Usage: tsx src/scripts/create-superadmin.ts [email] [password] [fullName]
const email = (process.argv[2] ?? 'superadmin@finsum.uz').toLowerCase();
const password = process.argv[3] ?? 'adminpass123';
const fullName = process.argv[4] ?? 'Super Admin';

const MERCHANT_ROLE_GRANTS: Record<string, string[]> = {
  agent: ['view_dashboard', 'view_deals', 'create_deal'],
  merchant_admin: [...MERCHANT_FEATURES],
};

const ADMIN_ROLE_GRANTS: Record<string, string[]> = {
  sales_manager: ['view_overview', 'view_merchants', 'manage_merchants', 'onboard_merchants'],
};

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

async function main() {
  // Ensure the seeded Roles exist (idempotent).
  await db
    .insert(roles)
    .values([
      {
        key: 'superadmin',
        name: 'Superadmin',
        platform: 'admin',
        isSuperAdmin: true,
        isSystem: true,
      },
      { key: 'sales_manager', name: 'Sales Manager', platform: 'admin', isSystem: true },
      { key: 'agent', name: 'Agent', platform: 'merchant', isSystem: true },
      { key: 'merchant_admin', name: 'Merchant Admin', platform: 'merchant', isSystem: true },
    ])
    .onConflictDoNothing();

  const roleRows = await db.select().from(roles);
  const roleId = (platform: string, key: string) =>
    roleRows.find((r) => r.platform === platform && r.key === key)!.id;

  for (const [key, features] of Object.entries(MERCHANT_ROLE_GRANTS)) {
    await db
      .insert(rolePermissions)
      .values(features.map((feature) => ({ roleId: roleId('merchant', key), feature })))
      .onConflictDoNothing();
  }

  for (const [key, features] of Object.entries(ADMIN_ROLE_GRANTS)) {
    await db
      .insert(rolePermissions)
      .values(features.map((feature) => ({ roleId: roleId('admin', key), feature })))
      .onConflictDoNothing();
  }
  console.log('✓ Seeded admin roles: sales_manager');

  const superRoleId = roleId('admin', 'superadmin');
  const passwordHash = await hashPassword(password);

  const [existing] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(adminUsers)
      .set({ roleId: superRoleId, active: true })
      .where(eq(adminUsers.id, existing.id));
    console.log(`✓ Updated existing admin ${email} → Superadmin`);
  } else {
    await db.insert(adminUsers).values({
      email,
      passwordHash,
      fullName,
      roleId: superRoleId,
      active: true,
      mustChangePassword: false,
    });
    console.log(`✓ Created Superadmin ${email}`);
  }

  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
