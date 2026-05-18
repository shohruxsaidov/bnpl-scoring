import pg from "pg";
import bcrypt from "bcrypt";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://shohruxsaidov:postgres@localhost:5432/scoring_app";

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function q(sql: string, params: unknown[] = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function seed() {
  console.log("🌱  Seeding scoring_app …\n");

  // ── Tenants ────────────────────────────────────────────────────────────────
  console.log("  tenants");
  const [techTenant] = await q(
    `INSERT INTO tenants (name, slug, active)
     VALUES ($1, $2, true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ["TechMart Uzbekistan", "techmart"],
  );
  const [furnitureTenant] = await q(
    `INSERT INTO tenants (name, slug, active)
     VALUES ($1, $2, true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ["Mebel Dunyo", "mebel-dunyo"],
  );

  // If already seeded, fetch existing ids
  const techId: string =
    techTenant?.id ??
    (await q(`SELECT id FROM tenants WHERE slug = 'techmart'`))[0].id;
  const furnitureId: string =
    furnitureTenant?.id ??
    (await q(`SELECT id FROM tenants WHERE slug = 'mebel-dunyo'`))[0].id;

  // ── Roles ──────────────────────────────────────────────────────────────────
  console.log("  roles");
  const agentRoleTech = await upsertRole(techId, "agent", "Issues Deals via the Wizard");
  const adminRoleTech = await upsertRole(techId, "merchant_admin", "Manages Tariffs, Products, Employees");
  const agentRoleFurniture = await upsertRole(furnitureId, "agent", "Issues Deals via the Wizard");
  const adminRoleFurniture = await upsertRole(furnitureId, "merchant_admin", "Manages Tariffs, Products, Employees");

  // ── Employees ──────────────────────────────────────────────────────────────
  console.log("  employees");
  const hash = await bcrypt.hash("password123", 10);

  // TechMart employees
  const [adminEmp] = await q(
    `INSERT INTO employees (tenant_id, full_name, phone, email, password_hash, active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [techId, "Alisher Karimov", "+998901234567", "alisher@techmart.uz", hash],
  );
  const adminId: string =
    adminEmp?.id ??
    (await q(`SELECT id FROM employees WHERE phone = '+998901234567'`))[0].id;

  const [agentEmp] = await q(
    `INSERT INTO employees (tenant_id, full_name, phone, email, password_hash, active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [techId, "Bobur Yusupov", "+998907654321", "bobur@techmart.uz", hash],
  );
  const agentId: string =
    agentEmp?.id ??
    (await q(`SELECT id FROM employees WHERE phone = '+998907654321'`))[0].id;

  // Mebel Dunyo employees
  const [furnitureAdminEmp] = await q(
    `INSERT INTO employees (tenant_id, full_name, phone, email, password_hash, active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [furnitureId, "Dilnoza Hasanova", "+998911112233", "dilnoza@mebel.uz", hash],
  );
  const furnitureAdminId: string =
    furnitureAdminEmp?.id ??
    (await q(`SELECT id FROM employees WHERE phone = '+998911112233'`))[0].id;

  // ── Employee ↔ Role assignments ────────────────────────────────────────────
  console.log("  employee_roles");
  await assignRole(adminId, adminRoleTech);
  await assignRole(adminId, agentRoleTech);   // Alisher has both roles (triggers picker)
  await assignRole(agentId, agentRoleTech);    // Bobur is agent-only
  await assignRole(furnitureAdminId, adminRoleFurniture);
  await assignRole(furnitureAdminId, agentRoleFurniture);

  // ── Categories ─────────────────────────────────────────────────────────────
  console.log("  categories");
  const elektronika = await upsertCategory(techId, "Elektronika");
  const smartfonlar = await upsertCategory(techId, "Smartfonlar", elektronika);
  const noutbuklar = await upsertCategory(techId, "Noutbuklar", elektronika);
  const televizorlar = await upsertCategory(techId, "Televizorlar", elektronika);
  const mebelCat = await upsertCategory(furnitureId, "Yotoqxona");
  const mebelCat2 = await upsertCategory(furnitureId, "Qo'shni xona");

  // ── Products — TechMart ────────────────────────────────────────────────────
  console.log("  products");
  // Prices in tiyin (1 UZS = 100 tiyin stored as bigint, e.g. 5_000_000 UZS = 500_000_000)
  await upsertProduct(techId, smartfonlar, "Samsung Galaxy A55", "SAM-A55", 4_499_000_00);
  await upsertProduct(techId, smartfonlar, "iPhone 15", "APL-IP15", 12_990_000_00);
  await upsertProduct(techId, smartfonlar, "Xiaomi Redmi Note 13", "XMI-RN13", 2_799_000_00);
  await upsertProduct(techId, noutbuklar, "Lenovo IdeaPad 5", "LEN-IP5", 7_200_000_00);
  await upsertProduct(techId, noutbuklar, "ASUS VivoBook 15", "ASUS-VB15", 6_500_000_00);
  await upsertProduct(techId, televizorlar, "Samsung 55\" QLED", "SAM-TV55", 8_900_000_00);
  await upsertProduct(techId, televizorlar, "LG 43\" 4K", "LG-TV43", 4_200_000_00);

  // Products — Mebel Dunyo
  await upsertProduct(furnitureId, mebelCat, "Krovat 180x200 Royal", "MEB-KR180", 3_800_000_00);
  await upsertProduct(furnitureId, mebelCat, "Shkaf 3-eshikli", "MEB-SHK3", 2_100_000_00);
  await upsertProduct(furnitureId, mebelCat2, "Divan L-shakl", "MEB-DIV-L", 5_600_000_00);

  // ── Tariffs ────────────────────────────────────────────────────────────────
  console.log("  tariffs");
  const tariff3 = await upsertTariff(techId, "3 oy — 10% ustama", 3, "10.00");
  const tariff6 = await upsertTariff(techId, "6 oy — 15% ustama", 6, "15.00");
  const tariff12 = await upsertTariff(techId, "12 oy — 22% ustama", 12, "22.00");
  const furnitureTariff6 = await upsertTariff(furnitureId, "6 oy — 12% ustama", 6, "12.00");
  const furnitureTariff12 = await upsertTariff(furnitureId, "12 oy — 20% ustama", 12, "20.00");

  // ── Scoring Models ─────────────────────────────────────────────────────────
  console.log("  scoring_models + criteria");
  const techModel = await upsertScoringModel(techId, "TechMart Standard v1");
  await upsertCriteria(techId, techModel, [
    { code: "income_level", label: "Daromad darajasi", weight: "0.250" },
    { code: "work_period", label: "Ish staji", weight: "0.200" },
    { code: "credit_history", label: "Kredit tarixi", weight: "0.200" },
    { code: "overdue_count", label: "Muddati o'tgan to'lovlar", weight: "0.150" },
    { code: "liabilities", label: "Joriy majburiyatlar", weight: "0.100" },
    { code: "card_score", label: "Karta skori (PlumGate)", weight: "0.100" },
  ]);

  const furnitureModel = await upsertScoringModel(furnitureId, "Mebel Dunyo Standard v1");
  await upsertCriteria(techId, furnitureModel, [
    { code: "income_level", label: "Daromad darajasi", weight: "0.300" },
    { code: "work_period", label: "Ish staji", weight: "0.200" },
    { code: "credit_history", label: "Kredit tarixi", weight: "0.250" },
    { code: "overdue_count", label: "Muddati o'tgan to'lovlar", weight: "0.150" },
    { code: "liabilities", label: "Joriy majburiyatlar", weight: "0.100" },
  ]);

  // ── Clients ────────────────────────────────────────────────────────────────
  console.log("  clients");
  const client1 = await upsertClient(
    techId,
    "Jasur Mirzaev",
    "+998935551122",
    "AA1234567",
    "12345678901234",
    "1990-05-15",
  );
  const client2 = await upsertClient(
    techId,
    "Malika Rahimova",
    "+998944449988",
    "BB9876543",
    "98765432109876",
    "1995-11-22",
  );
  const client3 = await upsertClient(
    furnitureId,
    "Sarvar Toshmatov",
    "+998912223344",
    "CC5556677",
    "55566677788899",
    "1988-03-08",
  );

  // ── Client cards ───────────────────────────────────────────────────────────
  console.log("  client_cards");
  await upsertClientCard(techId, client1, "8600 **** **** 1234", "tok_uzcard_client1", "0127", true);
  await upsertClientCard(techId, client2, "9860 **** **** 5678", "tok_humo_client2", "0228", true);

  // ── Deals ──────────────────────────────────────────────────────────────────
  console.log("  deals + baskets + installments");

  // Deal 1: Jasur buys Samsung A55 + LG TV on 6-month tariff
  const deal1Products = [
    { product: "Samsung Galaxy A55", sku: "SAM-A55", price: 4_499_000_00, qty: 1 },
    { product: "LG 43\" 4K", sku: "LG-TV43", price: 4_200_000_00, qty: 1 },
  ];
  await createDeal(techId, client1, agentId, tariff6, deal1Products, "active", 6);

  // Deal 2: Malika buys iPhone 15 on 12-month tariff
  const deal2Products = [
    { product: "iPhone 15", sku: "APL-IP15", price: 12_990_000_00, qty: 1 },
  ];
  await createDeal(techId, client2, adminId, tariff12, deal2Products, "active", 12);

  // Deal 3: Sarvar buys a sofa on 12-month furniture tariff
  const deal3Products = [
    { product: "Divan L-shakl", sku: "MEB-DIV-L", price: 5_600_000_00, qty: 1 },
  ];
  await createDeal(furnitureId, client3, furnitureAdminId, furnitureTariff12, deal3Products, "completed", 12);

  await pool.end();
  console.log("\n✅  Seed complete.");
  console.log("\n📋  Quick reference:");
  console.log("   Tenants:   TechMart Uzbekistan, Mebel Dunyo");
  console.log("   Employees: alisher@techmart.uz (agent+admin), bobur@techmart.uz (agent), dilnoza@mebel.uz (admin+agent)");
  console.log("   Password:  password123");
  console.log("   Clients:   3 clients, 2 with cards");
  console.log("   Deals:     3 deals with baskets and installment schedules");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsertRole(tenantId: string, name: string, description: string): Promise<string> {
  const [existing] = await q(
    `SELECT id FROM roles WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
    [tenantId, name],
  );
  if (existing) return existing.id;
  const [row] = await q(
    `INSERT INTO roles (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, name, description],
  );
  return row.id;
}

async function assignRole(employeeId: string, roleId: string) {
  await q(
    `INSERT INTO employee_roles (employee_id, role_id)
     VALUES ($1, $2) ON CONFLICT ON CONSTRAINT employee_role_uq DO NOTHING`,
    [employeeId, roleId],
  );
}

async function upsertCategory(tenantId: string, name: string, parentId?: string): Promise<string> {
  const [existing] = await q(
    `SELECT id FROM categories WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
    [tenantId, name],
  );
  if (existing) return existing.id;
  const [row] = await q(
    `INSERT INTO categories (tenant_id, name, parent_id) VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, name, parentId ?? null],
  );
  return row.id;
}

async function upsertProduct(
  tenantId: string,
  categoryId: string,
  name: string,
  sku: string,
  price: number,
): Promise<string> {
  const [existing] = await q(
    `SELECT id FROM products WHERE tenant_id = $1 AND sku = $2 AND deleted_at IS NULL`,
    [tenantId, sku],
  );
  if (existing) return existing.id;
  const [row] = await q(
    `INSERT INTO products (tenant_id, category_id, name, sku, price, active)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [tenantId, categoryId, name, sku, price],
  );
  return row.id;
}

async function upsertTariff(
  tenantId: string,
  name: string,
  termMonths: number,
  markupPercent: string,
): Promise<string> {
  const [existing] = await q(
    `SELECT id FROM tariffs WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
    [tenantId, name],
  );
  if (existing) return existing.id;
  const [row] = await q(
    `INSERT INTO tariffs (tenant_id, name, term_months, markup_percent, active)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [tenantId, name, termMonths, markupPercent],
  );
  return row.id;
}

async function upsertScoringModel(tenantId: string, name: string): Promise<string> {
  const [existing] = await q(
    `SELECT id FROM scoring_models WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`,
    [tenantId, name],
  );
  if (existing) return existing.id;
  const [row] = await q(
    `INSERT INTO scoring_models (tenant_id, name, version, active)
     VALUES ($1, $2, 1, true) RETURNING id`,
    [tenantId, name],
  );
  return row.id;
}

async function upsertCriteria(
  tenantId: string,
  modelId: string,
  criteria: { code: string; label: string; weight: string }[],
) {
  for (const c of criteria) {
    const [existing] = await q(
      `SELECT id FROM scoring_criteria WHERE tenant_id = $1 AND model_id = $2 AND code = $3`,
      [tenantId, modelId, c.code],
    );
    if (!existing) {
      await q(
        `INSERT INTO scoring_criteria (tenant_id, model_id, code, label, weight)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, modelId, c.code, c.label, c.weight],
      );
    }
  }
}

async function upsertClient(
  tenantId: string,
  fullName: string,
  phone: string,
  passportSerial: string,
  pinfl: string,
  birthDate: string,
): Promise<string> {
  const [existing] = await q(
    `SELECT id FROM clients WHERE tenant_id = $1 AND pinfl = $2 AND deleted_at IS NULL`,
    [tenantId, pinfl],
  );
  if (existing) return existing.id;
  const [row] = await q(
    `INSERT INTO clients (tenant_id, full_name, phone, passport_serial, pinfl, birth_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, fullName, phone, passportSerial, pinfl, birthDate],
  );
  return row.id;
}

async function upsertClientCard(
  tenantId: string,
  clientId: string,
  maskedPan: string,
  token: string,
  expiry: string,
  primary: boolean,
): Promise<string> {
  const [existing] = await q(
    `SELECT id FROM client_cards WHERE tenant_id = $1 AND token = $2`,
    [tenantId, token],
  );
  if (existing) return existing.id;
  const [row] = await q(
    `INSERT INTO client_cards (tenant_id, client_id, masked_pan, token, expiry, "primary")
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, clientId, maskedPan, token, expiry, primary],
  );
  return row.id;
}

async function createDeal(
  tenantId: string,
  clientId: string,
  agentId: string,
  tariffId: string,
  products: { product: string; sku: string; price: number; qty: number }[],
  status: string,
  termMonths: number,
) {
  const [existingDeal] = await q(
    `SELECT id FROM deals WHERE tenant_id = $1 AND client_id = $2 AND tariff_id = $3 AND deleted_at IS NULL LIMIT 1`,
    [tenantId, clientId, tariffId],
  );
  if (existingDeal) return;

  const principal = products.reduce((sum, p) => sum + p.price * p.qty, 0);
  const [tariffRow] = await q(`SELECT markup_percent FROM tariffs WHERE id = $1`, [tariffId]);
  const markup = parseFloat(tariffRow?.markup_percent ?? "0") / 100;
  const totalPayable = Math.round(principal * (1 + markup));

  const [deal] = await q(
    `INSERT INTO deals (tenant_id, client_id, agent_id, tariff_id, status, principal, total_payable)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [tenantId, clientId, agentId, tariffId, status, principal, totalPayable],
  );

  // Basket
  const [basket] = await q(
    `INSERT INTO deal_baskets (tenant_id, deal_id, total) VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, deal.id, principal],
  );

  // Look up product ids by SKU and insert basket items
  for (const p of products) {
    const [prod] = await q(`SELECT id FROM products WHERE tenant_id = $1 AND sku = $2`, [tenantId, p.sku]);
    if (prod) {
      await q(
        `INSERT INTO deal_basket_items (tenant_id, basket_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, basket.id, prod.id, p.qty, p.price],
      );
    }
  }

  // Installment schedule
  const monthlyAmount = Math.round(totalPayable / termMonths);
  const today = new Date();
  for (let i = 1; i <= termMonths; i++) {
    const dueDate = new Date(today);
    dueDate.setMonth(dueDate.getMonth() + i);
    const isPaid = status === "completed" || i <= 2;
    await q(
      `INSERT INTO installment_schedules (tenant_id, deal_id, sequence, due_date, amount, paid, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        deal.id,
        i,
        dueDate.toISOString().slice(0, 10),
        monthlyAmount,
        isPaid,
        isPaid ? new Date().toISOString() : null,
      ],
    );
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
