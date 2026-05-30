import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { adminUsers, branches, categories, merchantTariffs, merchantUsers, merchants, products, tariffs } from "./modules/id/db/schema.js";
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
  // ── Merchant & Branches ───────────────────────────────────────────────────
  console.log("Seeding merchant & branches...");

  await db
    .insert(merchants)
    .values({
      id: MERCHANT_ID,
      name: "TechnoMart",
      legalName: 'OOO "TechnoMart"',
      inn: "123456789",
      phone: "+998712345678",
      address: "Toshkent sh., Chilonzor t.",
      active: true,
    })
    .onConflictDoNothing();

  await db
    .insert(branches)
    .values([
      { id: BRANCH_A_ID, merchantId: MERCHANT_ID, name: "Chilonzor filiali", address: "Chilonzor ko'chasi 1", phone: "+998712345679", active: true },
      { id: BRANCH_B_ID, merchantId: MERCHANT_ID, name: "Yunusobod filiali", address: "Amir Temur ko'chasi 100", phone: "+998712345680", active: true },
    ])
    .onConflictDoNothing();

  console.log("  ✓ TechnoMart + 2 branches");

  console.log("\nSeeding merchant_users...");

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

  // ── Tariffs ──────────────────────────────────────────────────────────────
  console.log("\nSeeding tariffs...");

  const tariffRows = await db
    .insert(tariffs)
    .values([
      { name: "3 oy",  termMonths: 3,  markupPercent: "8.00",  active: true },
      { name: "6 oy",  termMonths: 6,  markupPercent: "12.00", active: true },
      { name: "12 oy", termMonths: 12, markupPercent: "18.00", active: true },
      { name: "24 oy", termMonths: 24, markupPercent: "28.00", active: true },
    ])
    .onConflictDoNothing()
    .returning({ id: tariffs.id, name: tariffs.name });

  for (const t of tariffRows) console.log(`  ✓ ${t.name}`);

  // Assign all tariffs to merchant 1
  if (tariffRows.length > 0) {
    await db
      .insert(merchantTariffs)
      .values(tariffRows.map((t) => ({ merchantId: MERCHANT_ID, tariffId: t.id })))
      .onConflictDoNothing();
    console.log(`  ✓ assigned ${tariffRows.length} tariff(s) to merchant ${MERCHANT_ID}`);
  }

  // ── Categories & Products ─────────────────────────────────────────────────
  console.log("\nSeeding categories & products...");

  const catRows = await db
    .insert(categories)
    .values([
      { merchantId: MERCHANT_ID, name: "Elektronika", active: true },
      { merchantId: MERCHANT_ID, name: "Maishiy texnika", active: true },
      { merchantId: MERCHANT_ID, name: "Mebel", active: true },
    ])
    .onConflictDoNothing()
    .returning({ id: categories.id, name: categories.name });

  const catMap = Object.fromEntries(catRows.map((c) => [c.name, c.id]));

  const productSeeds = [
    // Elektronika
    { name: "Samsung Galaxy A55",      tanNarxi: "4500000.00",  categoryId: catMap["Elektronika"] },
    { name: "iPhone 15",               tanNarxi: "12000000.00", categoryId: catMap["Elektronika"] },
    { name: "Xiaomi Redmi Note 13",    tanNarxi: "2800000.00",  categoryId: catMap["Elektronika"] },
    { name: 'Samsung TV 55"',          tanNarxi: "6500000.00",  categoryId: catMap["Elektronika"] },
    { name: "MacBook Air M2",          tanNarxi: "18000000.00", categoryId: catMap["Elektronika"] },
    // Maishiy texnika
    { name: "Artel Kir yuvish mashinasi 6kg", tanNarxi: "3200000.00", categoryId: catMap["Maishiy texnika"] },
    { name: "Samsung Muzlatgich 300L", tanNarxi: "5800000.00",  categoryId: catMap["Maishiy texnika"] },
    { name: "Midea Konditsioner 12BTU",tanNarxi: "4200000.00",  categoryId: catMap["Maishiy texnika"] },
    { name: "LG Changyutgich",         tanNarxi: "1500000.00",  categoryId: catMap["Maishiy texnika"] },
    // Mebel
    { name: "Divan 3-o'rinli",         tanNarxi: "4800000.00",  categoryId: catMap["Mebel"] },
    { name: "Yotoq xonasi to'plami",   tanNarxi: "9500000.00",  categoryId: catMap["Mebel"] },
    { name: "Ish stoli",               tanNarxi: "1800000.00",  categoryId: catMap["Mebel"] },
  ];

  const validProducts = productSeeds.filter(
    (p): p is typeof p & { categoryId: bigint } => p.categoryId !== undefined,
  );

  if (validProducts.length > 0) {
    await db
      .insert(products)
      .values(validProducts.map((p) => ({ ...p, merchantId: MERCHANT_ID, active: true })))
      .onConflictDoNothing();
    console.log(`  ✓ ${validProducts.length} product(s) across ${catRows.length} categor(ies)`);
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
