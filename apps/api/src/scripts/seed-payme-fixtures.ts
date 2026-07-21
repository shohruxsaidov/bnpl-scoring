import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  branches,
  dealItems,
  dealPaymentSchedules,
  deals,
  merchantUsers,
  merchants,
  users,
} from '@db/schema';

// ---------------------------------------------------------------------------
// Fixture deals for Payme sandbox certification.
//
// Payme's test suite runs its matrix against deal numbers you hand them, and it
// needs more than a happy path: it checks that an unknown account, a
// not-yet-active contract and a settled one all come back as account errors with
// the right codes. Driving the wizard by hand for each of those every time the
// sandbox resets is the kind of chore that ends with someone certifying against
// one deal and discovering the other branches in production.
//
// Creates three deals for one throwaway client:
//   active — 6 unpaid instalments, the one Payme actually pays        → allow
//   closed — every instalment settled                                 → -31052
//   draft  — exists but carries no debt                               → -31051
// (An unknown number needs no fixture: pick any number not printed below.)
//
// Refuses to run outside development/local — these are real rows in the deals
// table, and the One Active Deal index means a stray fixture can block a real
// client from opening a deal.
//
//   pnpm --filter @scoring/api seed:payme-fixtures
// ---------------------------------------------------------------------------

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
if (NODE_ENV === 'production') {
  console.error('refusing to seed Payme fixtures in production');
  process.exit(1);
}

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

const FIXTURE_PHONE = '998900000077';
const INSTALMENT_SOM = 500_000;
const TERM_MONTHS = 6;

/** dueDate for instalment n, counting from today. */
function dueDate(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const [merchant] = await db.select().from(merchants).limit(1);
  const [branch] = await db.select().from(branches).limit(1);
  const [agent] = await db.select().from(merchantUsers).limit(1);

  if (!merchant || !branch || !agent) {
    console.error('no merchant/branch/agent found — run seed:test-data first');
    process.exit(1);
  }

  // One throwaway client owns all three fixtures. Reused across runs so repeated
  // seeding does not litter the users table.
  let [user] = await db.select().from(users).where(eq(users.phone, FIXTURE_PHONE)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        phone: FIXTURE_PHONE,
        // Obviously-synthetic identity: a PINFL in a reserved-looking range and
        // a name nobody will mistake for a real borrower in the admin portal.
        pinfl: '00000000000077',
        firstName: 'Payme',
        lastName: 'Sandbox',
        birthDate: '1990-01-01',
        gender: 1,
      })
      .returning();
  }

  const total = INSTALMENT_SOM * TERM_MONTHS;

  const base = {
    merchantId: merchant.id,
    branchId: branch.id,
    agentId: agent.id,
    userId: user!.id,
    amount: total,
    totalPayable: total,
    termMonths: TERM_MONTHS,
    paymentDay: 15,
    lang: 'ru',
  };

  // The active fixture is the only one that may carry userId: the One Active
  // Deal unique index covers status in ('active','overdue'), so two of these
  // would collide. The other two are open/closed states it does not cover.
  const [active] = await db
    .insert(deals)
    .values({ ...base, status: 'active' })
    .returning();

  const [closed] = await db
    .insert(deals)
    .values({ ...base, status: 'closed' })
    .returning();

  const [draft] = await db
    .insert(deals)
    .values({ ...base, status: 'draft' })
    .returning();

  for (const [deal, paid] of [
    [active!, false],
    [closed!, true],
  ] as const) {
    await db.insert(dealItems).values({
      dealId: deal.id,
      productName: 'Payme sandbox fixture',
      price: String(total),
      quantity: 1,
    });

    await db.insert(dealPaymentSchedules).values(
      Array.from({ length: TERM_MONTHS }, (_, i) => ({
        dealId: deal.id,
        index: i + 1,
        dueDate: dueDate(i + 1),
        amount: INSTALMENT_SOM,
        paidAmount: paid ? INSTALMENT_SOM : 0,
        paid,
        paidAt: paid ? new Date() : null,
      })),
    );
  }

  console.log('Payme sandbox fixtures — give these deal_number values to Payme:');
  console.log(`  allow  (active, ${total} сум owed) → deal_number = ${active!.dealNumber}`);
  console.log(`  -31052 (fully settled)            → deal_number = ${closed!.dealNumber}`);
  console.log(`  -31051 (not active yet)           → deal_number = ${draft!.dealNumber}`);
  console.log(`  -31050 (unknown)                  → deal_number = 999999999`);
  console.log(`  -31001 (bad amount)               → any amount > ${total} сум on the active deal`);

  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
