import { Type } from '@sinclair/typebox';
import { StringEnum } from '@lib/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { listPayments } from './queries/list-payments/list-payments.handler';
import { listManualPayments } from './queries/list-manual-payments/list-manual-payments.handler';
import { searchDealsForManualPayment } from './queries/search-deals/search-deals.handler';
import { createManualPayment } from './commands/create-manual-payment/create-manual-payment.handler';
import { listPaymeTransactions } from './queries/list-payme-transactions/list-payme-transactions.handler';
import {
  bookStrandedPlumSession,
  listPlumSessions,
} from '../../client/payments/pay.service';
import type { DealPaymentSource, PlumPaymentSessionStatus } from '../../deals/schema';

const TAGS = ['Admin · Payments'];

export default async function adminPaymentRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const preHandler = app.verifyAdminJwt;

  const ListQuery = Type.Object({
    merchantId: Type.Optional(Type.String()),
  });

  fastify.get('/', { schema: { tags: TAGS, querystring: ListQuery }, preHandler }, async (request) => {
    const { merchantId } = request.query;
    const payments = await listPayments({
      merchantId: merchantId ? Number(merchantId) : undefined,
    });
    return { payments };
  });

  fastify.get(
    '/manual/deals',
    { schema: { tags: TAGS, querystring: Type.Object({ q: Type.String() }) }, preHandler },
    async (request) => {
      const deals = await searchDealsForManualPayment(request.query.q);
      return { deals };
    },
  );

  // Despite the path, this lists every money-in event — a Payme payment settles
  // the same instalments and belongs in the same register. `source` filters.
  const PaymentsQuery = Type.Object({
    source: Type.Optional(StringEnum(['manual', 'payme', 'plum'] as const)),
  });

  fastify.get(
    '/manual',
    { schema: { tags: TAGS, querystring: PaymentsQuery }, preHandler },
    async (request) => {
      const payments = await listManualPayments(request.query.source as DealPaymentSource | undefined);
      return { payments };
    },
  );

  /* ── Payme protocol state — read-only, no actions ────────────────────────
   * Separate from the payments register on purpose: these rows are Payme's
   * state machine, not our ledger. A pending row here means money that has NOT
   * been booked. Nothing in the admin portal may edit them — see the handler.
   */
  const PaymeQuery = Type.Object({
    state: Type.Optional(Type.Integer()),
    dealId: Type.Optional(Type.String({ format: 'uuid' })),
  });

  fastify.get(
    '/payme/transactions',
    { schema: { tags: TAGS, querystring: PaymeQuery }, preHandler },
    async (request) => {
      const transactions = await listPaymeTransactions({
        state: request.query.state,
        dealId: request.query.dealId,
      });
      return { transactions };
    },
  );

  /* ── Plum card-payment sessions — the stuck-money screen ─────────────────
   * Read-only plus ONE action. Like the Payme mirror above these rows are
   * protocol state, not the ledger — but unlike Payme they can end in a status
   * no automatic process can resolve: `debited_unbooked`, meaning Plumgate took
   * the client's money and allocation failed. Every such row is a client whose
   * balance is wrong until someone acts, which is why this screen exists at all.
   */
  const PlumSessionsQuery = Type.Object({
    // Defaults to the stranded ones — the only status that needs a human.
    status: Type.Optional(
      StringEnum([
        'debited_unbooked',
        'pending',
        'confirming',
        'booked',
        'failed',
        'expired',
      ] as const),
    ),
  });

  fastify.get(
    '/plum/sessions',
    { schema: { tags: TAGS, querystring: PlumSessionsQuery }, preHandler },
    async (request) => {
      // StringEnum widens to unknown at the type level; the schema is what
      // actually constrains the value, same as `source` above.
      const status = request.query.status as PlumPaymentSessionStatus | undefined;
      const sessions = await listPlumSessions(status ? [status] : undefined);
      return {
        sessions: sessions.map((s) => ({
          ...s,
          id: String(s.id),
          dealNumber: s.dealNumber != null ? String(s.dealNumber) : null,
          createdAt: s.createdAt.toISOString(),
        })),
      };
    },
  );

  /**
   * Book a payment Plumgate already collected. Not a "retry" of the charge —
   * the card was debited long ago; this only allocates money we are already
   * holding, so it is safe to press twice (the second press 409s on status).
   */
  fastify.post(
    '/plum/sessions/:id/book',
    {
      schema: { tags: TAGS, params: Type.Object({ id: Type.String({ pattern: '^\\d+$' }) }) },
      preHandler,
    },
    async (request, reply) => {
      try {
        const { paymentId } = await bookStrandedPlumSession(Number(request.params.id));
        return { paymentId: String(paymentId) };
      } catch (err: any) {
        // OVERPAYMENT here means the debt shrank since the debit — the money is
        // genuinely surplus and needs refunding at Plumgate, not booking.
        if (err.code === 'OVERPAYMENT') {
          return reply.status(409).send({ code: 'OVERPAYMENT', message: err.message });
        }
        if (err.statusCode) return reply.status(err.statusCode).sendError(err.code);
        throw err;
      }
    },
  );

  const CreateBody = Type.Object({
    dealId: Type.String({ format: 'uuid' }),
    amount: Type.Integer({ minimum: 1 }),
    paymentType: Type.Union([Type.Literal('replenishment'), Type.Literal('writing_off')]),
    // Shape only. The real bounds — not future, not before the deal existed —
    // depend on the deal row, so the handler enforces them.
    paymentDate: Type.String({ format: 'date' }),
    note: Type.Optional(Type.String()),
  });

  fastify.post('/manual', { schema: { tags: TAGS, body: CreateBody }, preHandler }, async (request, reply) => {
    const adminUserId = Number((request.user as { sub: string }).sub);
    try {
      const payment = await createManualPayment({ ...request.body, adminUserId });
      return reply.status(201).send({ payment });
    } catch (err: any) {
      if (err.code === 'OVERPAYMENT' || err.code === 'INVALID_PAYMENT_DATE') {
        return reply.status(400).send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });
}
