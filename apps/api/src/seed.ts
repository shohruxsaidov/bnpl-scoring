import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { adminUsers, merchantUsers } from "./modules/id/db/schema.js";
import { hashPassword as hashMerchantPassword } from "./modules/auth/merchant/service.js";
import { hashPassword as hashAdminPassword } from "./modules/auth/admin/service.js";

const client = postgres(process.env["DATABASE_URL"]!);
const db = drizzle(client);

const MERCHANT_ID = 1n;
const BRANCH_A_ID = 1n;
const BRANCH_B_ID = 2n;

const seeds = [
  {
    email: "admin@technomart.uz",
    password: "password123",
    fullName: "Aziz Karimov",
    merchantId: MERCHANT_ID,
    branchId: BRANCH_A_ID,
    roles: ["merchant_admin", "agent"],
  },
  {
    email: "agent@technomart.uz",
    password: "password123",
    fullName: "Dilnoza Yusupova",
    merchantId: MERCHANT_ID,
    branchId: BRANCH_A_ID,
    roles: ["agent"],
  },
  {
    email: "branch@technomart.uz",
    password: "password123",
    fullName: "Sardor Toshmatov",
    merchantId: MERCHANT_ID,
    branchId: BRANCH_B_ID,
    roles: ["branch_admin"],
  },
];

async function seed() {
  console.log("Seeding merchant_users...");

  for (const s of seeds) {
    const passwordHash = await hashMerchantPassword(s.password);
    await db
      .insert(merchantUsers)
      .values({
        email: s.email,
        passwordHash,
        fullName: s.fullName,
        merchantId: s.merchantId,
        branchId: s.branchId,
        roles: s.roles,
        active: true,
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${s.email}  (roles: ${s.roles.join(", ")})`);
  }

  console.log("\nSeeding admin_users...");

  const adminSeeds = [
    { email: "ops@finsum.uz", password: "adminpass123", fullName: "Operations Lead" },
    { email: "finance@finsum.uz", password: "adminpass123", fullName: "Finance Admin" },
  ];

  for (const a of adminSeeds) {
    const passwordHash = await hashAdminPassword(a.password);
    await db
      .insert(adminUsers)
      .values({ email: a.email, passwordHash, fullName: a.fullName })
      .onConflictDoNothing();
    console.log(`  ✓ ${a.email}`);
  }

  console.log("\nSeed credentials:");
  console.log("  Merchant (password: password123):");
  console.log("    admin@technomart.uz   → merchant_admin + agent (role picker)");
  console.log("    agent@technomart.uz   → agent (direct)");
  console.log("    branch@technomart.uz  → branch_admin (direct)");
  console.log("  Platform Admin (password: adminpass123):");
  console.log("    ops@finsum.uz         → platform admin");
  console.log("    finance@finsum.uz     → platform admin");

  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
