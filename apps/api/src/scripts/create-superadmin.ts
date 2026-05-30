import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { adminUsers, rolePermissions, roles } from "../modules/id/db/schema";
import { hashPassword } from "../modules/auth/admin/service";
import { MERCHANT_FEATURES } from "../rbac/features";

// Usage: tsx src/scripts/create-superadmin.ts [email] [password] [fullName]
const email = (process.argv[2] ?? "superadmin@finsum.uz").toLowerCase();
const password = process.argv[3] ?? "adminpass123";
const fullName = process.argv[4] ?? "Super Admin";

const MERCHANT_ROLE_GRANTS: Record<string, string[]> = {
  agent: ["view_dashboard", "view_deals", "create_deal", "view_notifications"],
  merchant_admin: [...MERCHANT_FEATURES],
};

const client = postgres(process.env["DATABASE_URL"]!);
const db = drizzle(client);

async function main() {
  // Ensure the seeded Roles exist (idempotent).
  await db
    .insert(roles)
    .values([
      { key: "superadmin", name: "Superadmin", platform: "admin", isSuperadmin: true, isSystem: true },
      { key: "agent", name: "Agent", platform: "merchant", isSystem: true },
      { key: "merchant_admin", name: "Merchant Admin", platform: "merchant", isSystem: true },
    ])
    .onConflictDoNothing();

  const roleRows = await db.select().from(roles);
  const roleId = (platform: string, key: string) =>
    roleRows.find((r) => r.platform === platform && r.key === key)!.id;

  for (const [key, features] of Object.entries(MERCHANT_ROLE_GRANTS)) {
    await db
      .insert(rolePermissions)
      .values(features.map((feature) => ({ roleId: roleId("merchant", key), feature })))
      .onConflictDoNothing();
  }

  const superRoleId = roleId("admin", "superadmin");
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
