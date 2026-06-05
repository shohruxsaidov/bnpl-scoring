import 'dotenv/config'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { clients } from '../modules/id/db/schema'
import { deals, dealPaymentSchedules } from '../modules/deals/db/schema'

// Seeds overdue deals across all four aging buckets so the Collection Board
// shows realistic data in development.
//
// Assumes merchant_id=1, branch_id=1, agent_id=2 already exist (created by
// the onboarding wizard or create-superadmin script).
const MERCHANT_ID = 1n
const BRANCH_ID = 1n
const AGENT_ID = 2n

const pg = postgres(process.env['DATABASE_URL']!)
const db = drizzle(pg)

// Reference date: 2026-05-31
function daysAgo(n: number): string {
  const d = new Date('2026-05-31')
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const MOCK_CLIENTS = [
  { firstName: 'Alibek',  lastName: 'Karimov',     phone: '998901001001', pinfl: '10000000000001' },
  { firstName: 'Malika',  lastName: 'Yusupova',    phone: '998901001002', pinfl: '10000000000002' },
  { firstName: 'Jasur',   lastName: 'Mirzayev',    phone: '998901001003', pinfl: '10000000000003' },
  { firstName: 'Nodira',  lastName: 'Toshmatova',  phone: '998901001004', pinfl: '10000000000004' },
  { firstName: 'Bobur',   lastName: 'Xolmatov',    phone: '998901001005', pinfl: '10000000000005' },
  { firstName: 'Zulfiya', lastName: 'Abdullayeva', phone: '998901001006', pinfl: '10000000000006' },
  { firstName: 'Sherzod', lastName: 'Normatov',    phone: '998901001007', pinfl: '10000000000007' },
  { firstName: 'Hulkar',  lastName: 'Raximova',    phone: '998901001008', pinfl: '10000000000008' },
]

// Each entry puts one overdue installment in the given aging bucket
const DEAL_CONFIGS: { daysOverdue: number; installment: bigint }[] = [
  { daysOverdue: 5,   installment: 150_000_000n }, // 1-30
  { daysOverdue: 20,  installment: 220_000_000n }, // 1-30
  { daysOverdue: 35,  installment: 300_000_000n }, // 31-60
  { daysOverdue: 55,  installment: 180_000_000n }, // 31-60
  { daysOverdue: 70,  installment: 450_000_000n }, // 61-90
  { daysOverdue: 85,  installment: 270_000_000n }, // 61-90
  { daysOverdue: 100, installment: 500_000_000n }, // 90+
  { daysOverdue: 150, installment: 350_000_000n }, // 90+
]

async function main() {
  const pinflList = MOCK_CLIENTS.map((c) => c.pinfl)

  await db
    .insert(clients)
    .values(
      MOCK_CLIENTS.map((c) => ({
        ...c,
        birthDate: '1990-01-01',
        gender: 'male',
        nationality: 'uzbek',
        myidVerifiedAt: new Date(),
        merchantId: MERCHANT_ID,
        branchId: BRANCH_ID,
      })),
    )
    .onConflictDoNothing()

  const seededClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(inArray(clients.pinfl, pinflList))

  console.log(`✓ Clients ready (${seededClients.length})`)

  for (let i = 0; i < DEAL_CONFIGS.length; i++) {
    const { daysOverdue, installment } = DEAL_CONFIGS[i]!
    const clientId = seededClients[i % seededClients.length]!.id
    const overdueDate = daysAgo(daysOverdue)
    const futureDate = daysAgo(-30)

    const [deal] = await db
      .insert(deals)
      .values({
        merchantId: MERCHANT_ID,
        branchId: BRANCH_ID,
        agentId: AGENT_ID,
        clientId,
        status: 'active',
        amount: installment * 12n,
        totalPayable: installment * 12n,
        termMonths: 12,
        paymentDay: 5,
      })
      .returning({ id: deals.id })

    await db.insert(dealPaymentSchedules).values([
      { dealId: deal!.id, index: 1, dueDate: overdueDate, amount: installment },
      { dealId: deal!.id, index: 2, dueDate: futureDate,  amount: installment },
    ])

    console.log(`  ✓ Deal ${deal!.id} — ${daysOverdue}d overdue (due ${overdueDate})`)
  }

  console.log('\n✓ Collection Board seed complete.')
  await pg.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
