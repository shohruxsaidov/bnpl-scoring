import 'dotenv/config';
import { randomUUID } from 'node:crypto';
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
  plumPaymentSessions,
  users,
} from '@db/schema';

// ---------------------------------------------------------------------------
// Fixtures for the admin stuck-payments screen.
//
// A `debited_unbooked` row is, by design, almost impossible to produce on
// purpose: it needs Plumgate to take money and our booking to fail in the same
// second. Which means the screen that resolves those rows would otherwise ship
// untested and first run for real during an incident, on an angry client's
// money — the worst possible moment to discover the Book button 500s.
//
// Creates one throwaway client with four sessions covering every branch the UI
// has to handle:
//   stranded  — bookable; pressing Book allocates it and the row leaves the list
//   overpaid  — deal already settled, so Book returns 409 OVERPAYMENT and the
//               service reclassifies the row to needs_refund
//   refund    — already needs_refund; only Resolve can close it
//   resolved  — closed by hand, so the resolved filter has something in it
//
// Refuses to run outside development/local: these are rows claiming money moved.
//
//   pnpm --filter @scoring/api seed:plum-stuck-fixtures
// ---------------------------------------------------------------------------

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
if (NODE_ENV === 'production') {
  console.error('refusing to seed Plum stuck fixtures in production');
  process.exit(1);
}

const client = postgres(process.env['DATABASE_URL']!);
const db = drizzle(client);

const FIXTURE_PHONE = '998900000078';
const INSTALMENT_SOM = 500_000;
const TERM_MONTHS = 6;
/** Well under one instalment, so booking it can never accidentally close a deal. */
const SESSION_AMOUNT_SOM = 250_000;

function dueDate(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

/** N days ago — the screen sorts oldest-first, so the ages need to differ. */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  const [merchant] = await db.select().from(merchants).limit(1);
  const [branch] = await db.select().from(branches).limit(1);
  const [agent] = await db.select().from(merchantUsers).limit(1);

  if (!merchant || !branch || !agent) {
    console.error('no merchant/branch/agent found — run seed:test-data first');
    process.exit(1);
  }

  let [user] = await db.select().from(users).where(eq(users.phone, FIXTURE_PHONE)).limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        phone: FIXTURE_PHONE,
        pinfl: '00000000000078',
        firstName: 'Plum',
        lastName: 'Stuck',
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

  // Only ONE of these may be active: the One Active Deal unique index covers
  // status in ('active','overdue'). The other three sessions hang off closed
  // deals, which is realistic — an overpayment stranding happens precisely
  // because the deal got settled by another rail while the debit was in flight.
  const [payable] = await db
    .insert(deals)
    .values({ ...base, status: 'active' })
    .returning();
  const [settled] = await db
    .insert(deals)
    .values({ ...base, status: 'closed' })
    .returning();

  for (const [deal, paid] of [
    [payable!, false],
    [settled!, true],
  ] as const) {
    await db.insert(dealItems).values({
      dealId: deal.id,
      productName: 'Plum stuck-payment fixture',
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

  const sessionBase = {
    userId: user!.id,
    cardId: 999_001,
    amountSom: SESSION_AMOUNT_SOM,
  };

  const [stranded] = await db
    .insert(plumPaymentSessions)
    .values({
      ...sessionBase,
      dealId: payable!.id,
      extraId: randomUUID(),
      plumSession: Date.now(),
      plumTransactionId: `FIXTURE-${Date.now()}`,
      status: 'debited_unbooked',
      failureCode: 'booking_failed',
      createdAt: daysAgo(3),
    })
    .returning();

  const [overpaid] = await db
    .insert(plumPaymentSessions)
    .values({
      ...sessionBase,
      dealId: settled!.id,
      extraId: randomUUID(),
      plumSession: Date.now() + 1,
      plumTransactionId: `FIXTURE-${Date.now() + 1}`,
      status: 'debited_unbooked',
      // The sweeper's code: we never learned whether the debit landed. The most
      // confusing row an operator can meet, so it belongs in the fixture set.
      failureCode: 'confirm_interrupted',
      createdAt: daysAgo(1),
    })
    .returning();

  const [refund] = await db
    .insert(plumPaymentSessions)
    .values({
      ...sessionBase,
      dealId: settled!.id,
      extraId: randomUUID(),
      plumSession: Date.now() + 2,
      plumTransactionId: `FIXTURE-${Date.now() + 2}`,
      status: 'needs_refund',
      failureCode: 'overpayment',
      createdAt: daysAgo(9),
    })
    .returning();

  await db.insert(plumPaymentSessions).values({
    ...sessionBase,
    dealId: settled!.id,
    extraId: randomUUID(),
    plumSession: Date.now() + 3,
    plumTransactionId: `FIXTURE-${Date.now() + 3}`,
    status: 'resolved',
    failureCode: 'overpayment',
    resolutionReason: 'refunded_at_plumgate',
    resolutionNote: 'Фикстура: возврат оформлен в кабинете Plumgate, тикет SUP-0001.',
    resolvedAt: daysAgo(2),
    createdAt: daysAgo(14),
  });

  console.log('Plum stuck-payment fixtures for /payments/stuck:');
  console.log(`  bookable      → session ${stranded!.id}, deal ${payable!.dealNumber} (Book succeeds)`);
  console.log(`  overpayment   → session ${overpaid!.id}, deal ${settled!.dealNumber} (Book 409s, row → needs_refund)`);
  console.log(`  needs_refund  → session ${refund!.id} (only Resolve closes it)`);
  console.log(`  client        → ${FIXTURE_PHONE}, Plum Stuck`);

  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
