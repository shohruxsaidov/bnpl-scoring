import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { merchantUsers } from "./modules/id/db/schema.js";
import { hashPassword } from "./modules/auth/merchant/service.js";

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
    const passwordHash = await hashPassword(s.password);
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

  console.log("\nSeed credentials (password: password123):");
  console.log("  admin@technomart.uz   → roles: merchant_admin, agent  (triggers role picker)");
  console.log("  agent@technomart.uz   → roles: agent                  (direct login)");
  console.log("  branch@technomart.uz  → roles: branch_admin           (direct login)");

  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
