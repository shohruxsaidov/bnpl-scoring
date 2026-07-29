import { Type } from '@sinclair/typebox';
import { StringEnum } from '@lib/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { listPayments } from './queries/list-payments/list-payments.handler';
import type { PaymentSortBy } from './queries/list-payments/list-payments.query';
import { searchDealsForManualPayment } from './queries/search-deals/search-deals.handler';
import { createManualPayment } from './commands/create-manual-payment/create-manual-payment.handler';
import { listPaymeTransactions } from './queries/list-payme-transactions/list-payme-transactions.handler';
import {
  bookStrandedPlumSession,
  countStrandedPlumSessions,
  listPlumSessions,
  resolveStrandedPlumSession,
} from '../../client/payments/pay.service';
import type {
  DealPaymentSource,
  PlumPaymentSessionStatus,
  PlumSessionResolutionReason,
} from '../../deals/schema';

const TAGS = ['Admin · Payments'];

export default async function adminPaymentRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const preHandler = app.verifyAdminJwt;

  /* ── The payments register ───────────────────────────────────────────────
   * Every money-in event against a deal, whatever the rail. `source` narrows it
   * to one — which is all the "manual payments" view is: this endpoint with
   * source=manual. Paginated because deal_payments only ever grows.
   */
  const ListQuery = Type.Object({
    merchantId: Type.Optional(Type.String()),
    source: Type.Optional(StringEnum(['manual', 'payme', 'plum'] as const)),
    dateFrom: Type.Optional(Type.String({ format: 'date' })),
    dateTo: Type.Optional(Type.String({ format: 'date' })),
    q: Type.Optional(Type.String()),
    page: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    sortBy: Type.Optional(StringEnum(['paymentDate', 'amount'] as const)),
    sortDir: Type.Optional(StringEnum(['asc', 'desc'] as const)),
  });

  fastify.get('/', { schema: { tags: TAGS, querystring: ListQuery }, preHandler }, async (request) => {
    const { merchantId, source, sortBy, sortDir, ...rest } = request.query;
    // StringEnum widens to unknown at the type level; the schema is what
    // actually constrains these values.
    return listPayments({
      ...rest,
      merchantId: merchantId ? Number(merchantId) : undefined,
      source: source as DealPaymentSource | undefined,
      sortBy: sortBy as PaymentSortBy | undefined,
      sortDir: sortDir as 'asc' | 'desc' | undefined,
    });
  });

  fastify.get(
    '/manual/deals',
    { schema: { tags: TAGS, querystring: Type.Object({ q: Type.String() }) }, preHandler },
    async (request) => {
      const deals = await searchDealsForManualPayment(request.query.q);
      return { deals };
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
   * Read-only plus TWO actions. Like the Payme mirror above these rows are
   * protocol state, not the ledger — but unlike Payme they can end in statuses
   * no automatic process can resolve: `debited_unbooked` (Plumgate took the
   * client's money and allocation failed) and `needs_refund` (allocation was
   * tried and proved impossible). Every such row is a client whose balance is
   * wrong until someone acts, which is why this screen exists at all.
   *
   * The status filter is deliberately NOT the full enum. `booked` alone is the
   * entire history of card payments and this endpoint does not paginate; the
   * ledger view (`GET /` with source=plum) is where that belongs.
   */
  const PlumSessionsQuery = Type.Object({
    // Defaults to both stranded statuses — the rows that need a human.
    status: Type.Optional(
      StringEnum([
        'debited_unbooked',
        'needs_refund',
        'resolved',
        'pending',
        'confirming',
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
          resolvedAt: s.resolvedAt ? s.resolvedAt.toISOString() : null,
        })),
      };
    },
  );

  /** How many rows are waiting on a human. Feeds the nav badge and the overview tile. */
  fastify.get('/plum/sessions/stranded-count', { schema: { tags: TAGS }, preHandler }, async () => {
    return { count: await countStrandedPlumSessions() };
  });

  /**
   * Book a payment Plumgate already collected. Not a "retry" of the charge —
   * the card was debited long ago; this only allocates money we are already
   * holding, so it is safe to press twice (the second press 409s on status,
   * concurrently as well as sequentially — the service locks the row).
   */
  fastify.post(
    '/plum/sessions/:id/book',
    {
      schema: { tags: TAGS, params: Type.Object({ id: Type.String({ pattern: '^\\d+$' }) }) },
      preHandler,
    },
    async (request, reply) => {
      const adminUserId = Number((request.user as { sub: string }).sub);
      try {
        const { paymentId } = await bookStrandedPlumSession(
          Number(request.params.id),
          adminUserId,
        );
        return { paymentId: String(paymentId) };
      } catch (err: any) {
        // OVERPAYMENT here means the debt shrank since the debit — the money is
        // genuinely surplus and needs refunding at Plumgate, not booking. The
        // service has already moved the row to `needs_refund`; the client is
        // expected to follow up with /resolve once the refund is done.
        if (err.code === 'OVERPAYMENT') {
          return reply.status(409).send({ code: 'OVERPAYMENT', message: err.message });
        }
        if (err.statusCode) return reply.status(err.statusCode).sendError(err.code);
        throw err;
      }
    },
  );

  /**
   * Close a stranded row without booking it. Moves no money — refunds happen in
   * Plumgate's own dashboard — it records that a human dealt with it and why.
   */
  const ResolveBody = Type.Object({
    reason: StringEnum(['refunded_at_plumgate', 'no_debit_occurred', 'other'] as const),
    // Mandatory, and mandatory with substance: "ok" a year from now explains
    // nothing about money that left a client's card.
    note: Type.String({ minLength: 10, maxLength: 1000 }),
  });

  fastify.post(
    '/plum/sessions/:id/resolve',
    {
      schema: {
        tags: TAGS,
        params: Type.Object({ id: Type.String({ pattern: '^\\d+$' }) }),
        body: ResolveBody,
      },
      preHandler,
    },
    async (request, reply) => {
      const adminUserId = Number((request.user as { sub: string }).sub);
      try {
        await resolveStrandedPlumSession({
          sessionId: Number(request.params.id),
          reason: request.body.reason as PlumSessionResolutionReason,
          note: request.body.note,
          adminUserId,
        });
        return { ok: true };
      } catch (err: any) {
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
