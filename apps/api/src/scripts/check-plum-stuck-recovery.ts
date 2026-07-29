import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@db';
import {
  adminUsers,
  branches,
  dealItems,
  dealPayments,
  dealPaymentSchedules,
  deals,
  merchantUsers,
  merchants,
  paymentAllocations,
  plumPaymentSessions,
  users,
} from '@db/schema';
import {
  bookStrandedPlumSession,
  resolveStrandedPlumSession,
} from '../modules/client/payments/pay.service';

// ---------------------------------------------------------------------------
// Executable check for the stranded-payment recovery path.
//
// This repo has no test runner, and installing one to cover a single service is
// a decision for a wider conversation than this change — but the concurrency
// guarantee below CANNOT be verified by hand: you cannot double-click reliably
// enough to lose a race, and the failure it protects against is booking a
// client's single card debit twice. So it lives here as a script that seeds,
// asserts, cleans up after itself, and exits non-zero on failure.
//
//   pnpm --filter @scoring/api check:plum-stuck-recovery
//
// Covers:
//   1. happy path        — Book allocates once, row goes 'booked'
//   2. concurrency       — two simultaneous Books produce ONE ledger row
//   3. overpayment       — Book on a settled deal 409s and reclassifies the row
//   4. resolve           — closes a stranded row, and refuses to close it twice
// ---------------------------------------------------------------------------

const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
if (NODE_ENV === 'production') {
  console.error('refusing to run recovery checks in production');
  process.exit(1);
}

const RUN = Date.now().toString().slice(-9);
const INSTALMENT_SOM = 500_000;
const TERM_MONTHS = 6;
const SESSION_AMOUNT_SOM = 250_000;

let failures = 0;

function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}`, detail ?? '');
  }
}

function dueDate(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const [merchant] = await db.select().from(merchants).limit(1);
  const [branch] = await db.select().from(branches).limit(1);
  const [agent] = await db.select().from(merchantUsers).limit(1);
  const [admin] = await db.select().from(adminUsers).limit(1);

  if (!merchant || !branch || !agent || !admin) {
    console.error('needs at least one merchant, branch, agent and admin user — run the seeds first');
    process.exit(1);
  }

  // A fresh client per run: the One Active Deal unique index means a leftover
  // active deal from a previous run would block this one.
  const [user] = await db
    .insert(users)
    .values({
      phone: `9989${RUN}`,
      pinfl: `0000${RUN}0`,
      firstName: 'Recovery',
      lastName: 'Check',
      birthDate: '1990-01-01',
      gender: 1,
    })
    .returning();

  const total = INSTALMENT_SOM * TERM_MONTHS;
  const dealBase = {
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

  const madeDeals: string[] = [];

  async function makeDeal(status: 'active' | 'closed'): Promise<string> {
    const [deal] = await db
      .insert(deals)
      .values({ ...dealBase, status })
      .returning();
    await db.insert(dealItems).values({
      dealId: deal!.id,
      productName: 'recovery check',
      price: String(total),
      quantity: 1,
    });
    await db.insert(dealPaymentSchedules).values(
      Array.from({ length: TERM_MONTHS }, (_, i) => ({
        dealId: deal!.id,
        index: i + 1,
        dueDate: dueDate(i + 1),
        amount: INSTALMENT_SOM,
        paidAmount: status === 'closed' ? INSTALMENT_SOM : 0,
        paid: status === 'closed',
        paidAt: status === 'closed' ? new Date() : null,
      })),
    );
    madeDeals.push(deal!.id);
    return deal!.id;
  }

  async function makeSession(dealId: string): Promise<number> {
    const [row] = await db
      .insert(plumPaymentSessions)
      .values({
        userId: user!.id,
        dealId,
        cardId: 999_002,
        amountSom: SESSION_AMOUNT_SOM,
        extraId: randomUUID(),
        plumTransactionId: `CHECK-${randomUUID().slice(0, 8)}`,
        status: 'debited_unbooked',
        failureCode: 'booking_failed',
      })
      .returning();
    return row!.id;
  }

  async function statusOf(sessionId: number) {
    const [row] = await db
      .select()
      .from(plumPaymentSessions)
      .where(eq(plumPaymentSessions.id, sessionId))
      .limit(1);
    return row;
  }

  async function paymentCount(dealId: string) {
    const rows = await db.select().from(dealPayments).where(eq(dealPayments.dealId, dealId));
    return rows;
  }

  try {
    // ── 1. happy path ──────────────────────────────────────────────────────
    console.log('\n1. Book allocates a stranded payment');
    {
      const dealId = await makeDeal('active');
      const sessionId = await makeSession(dealId);

      const { paymentId } = await bookStrandedPlumSession(sessionId, admin!.id);
      const row = await statusOf(sessionId);
      const payments = await paymentCount(dealId);

      check('session becomes booked', row!.status === 'booked', row!.status);
      check('session points at the ledger row', row!.paymentId === paymentId);
      check('exactly one payment booked', payments.length === 1, payments.length);
      check(
        'the acting admin is recorded on the ledger row',
        payments[0]?.adminUserId === admin!.id,
        payments[0]?.adminUserId,
      );
      check(
        'the rail stays plum',
        payments[0]?.source === 'plum',
        payments[0]?.source,
      );
    }

    // ── 2. concurrency — the reason this file exists ───────────────────────
    console.log('\n2. Two simultaneous Books book once');
    {
      const dealId = await makeDeal('active');
      const sessionId = await makeSession(dealId);

      const results = await Promise.allSettled([
        bookStrandedPlumSession(sessionId, admin!.id),
        bookStrandedPlumSession(sessionId, admin!.id),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      const payments = await paymentCount(dealId);

      check('exactly one call succeeds', ok.length === 1, ok.length);
      check(
        'the loser 409s on status',
        rejected.length === 1 && rejected[0]?.reason?.code === 'payment_session_not_stranded',
        rejected[0]?.reason?.code,
      );
      check(
        'the client is debited once and booked once',
        payments.length === 1,
        `${payments.length} ledger rows for one debit`,
      );
    }

    // ── 3. overpayment reclassifies rather than just failing ───────────────
    console.log('\n3. Book on a settled deal parks the row for refund');
    {
      const dealId = await makeDeal('closed');
      const sessionId = await makeSession(dealId);

      let code: string | undefined;
      try {
        await bookStrandedPlumSession(sessionId, admin!.id);
      } catch (err: any) {
        code = err.code;
      }
      const row = await statusOf(sessionId);
      const payments = await paymentCount(dealId);

      check('Book refuses with OVERPAYMENT', code === 'OVERPAYMENT', code);
      check('nothing is allocated', payments.length === 0, payments.length);
      check('the row moves to needs_refund', row!.status === 'needs_refund', row!.status);

      // ── 4. resolve closes it, once ───────────────────────────────────────
      console.log('\n4. Resolve closes a stranded row exactly once');
      await resolveStrandedPlumSession({
        sessionId,
        reason: 'refunded_at_plumgate',
        note: 'Возврат оформлен в кабинете Plumgate — проверка recovery.',
        adminUserId: admin!.id,
      });
      const resolved = await statusOf(sessionId);
      check('status is resolved', resolved!.status === 'resolved', resolved!.status);
      check('the reason is recorded', resolved!.resolutionReason === 'refunded_at_plumgate');
      check('the resolver is recorded', resolved!.resolvedByAdminUserId === admin!.id);
      check('resolvedAt is stamped', resolved!.resolvedAt != null);

      let secondCode: string | undefined;
      try {
        await resolveStrandedPlumSession({
          sessionId,
          reason: 'other',
          note: 'вторая попытка закрытия того же ряда',
          adminUserId: admin!.id,
        });
      } catch (err: any) {
        secondCode = err.code;
      }
      check(
        'a second resolve is refused',
        secondCode === 'payment_session_not_stranded',
        secondCode,
      );
    }
  } finally {
    // ── cleanup, in FK order ───────────────────────────────────────────────
    if (madeDeals.length) {
      const paymentRows = await db
        .select({ id: dealPayments.id })
        .from(dealPayments)
        .where(inArray(dealPayments.dealId, madeDeals));
      const paymentIds = paymentRows.map((p) => p.id);

      await db.delete(plumPaymentSessions).where(inArray(plumPaymentSessions.dealId, madeDeals));
      if (paymentIds.length) {
        await db
          .delete(paymentAllocations)
          .where(inArray(paymentAllocations.paymentId, paymentIds));
        await db.delete(dealPayments).where(inArray(dealPayments.id, paymentIds));
      }
      await db
        .delete(dealPaymentSchedules)
        .where(inArray(dealPaymentSchedules.dealId, madeDeals));
      await db.delete(dealItems).where(inArray(dealItems.dealId, madeDeals));
      await db.delete(deals).where(inArray(deals.id, madeDeals));
    }
    await db.delete(users).where(eq(users.id, user!.id));
  }

  console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) FAILED`);
  // The push queue keeps a Redis connection open on the happy path; nothing left
  // to wait for, so leave deliberately rather than hanging.
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
