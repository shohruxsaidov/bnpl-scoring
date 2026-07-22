import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { listClientPaymentsByDeal } from './queries';

// ---------------------------------------------------------------------------
// Client Payments by Deal — GET /client/payments-by-deal.
//
// The same money-in events as GET /client/payments, grouped under the credit
// they were paid against: one card per deal, its payments nested. Kept in its
// own plugin because it pages over DEALS while the flat feed pages over
// PAYMENTS — two different pagination units cannot share a handler without one
// of them lying about `total`.
//
// Scoped to request.user.sub; a client only ever sees their own deals.
// ---------------------------------------------------------------------------

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default async function clientPaymentsByDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Payments'];
  const guards = [app.verifyClientJwt];

  const PaymentItem = Type.Object({
    id: Type.String(),
    /** In som. */
    amount: Type.Number(),
    // How the money was initiated, not how it arrived.
    source: Type.Union([Type.Literal('manual'), Type.Literal('payme')]),
    // Free text in the column, so free text here — a new rail must not make an
    // existing payment fail response validation and vanish from the history.
    paymentType: Type.String(),
    createdAt: Type.String(),
  });

  const DealGroup = Type.Object({
    // Deep-links into GET /client/deals/:id for the basket and schedule.
    dealId: Type.String(),
    dealNumber: Type.String(),
    status: Type.String(),
    merchantName: Type.String(),
    /** In som. */
    totalPayable: Type.Number(),
    // Lifetime sum of the payments below — never windowed, so it can always be
    // read against totalPayable as "paid X of Y".
    paidTotal: Type.Number(),
    // Complete: a deal's payments are never split across pages.
    payments: Type.Array(PaymentItem),
  });

  const ListQuery = Type.Object({
    // 1-based paging over DEALS, not payments.
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_LIMIT })),
  });

  /* ── GET /client/payments-by-deal — my payments, grouped by credit ─────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List my payments grouped by deal',
        description:
          'Every payment the authenticated client has made, grouped under the credit it ' +
          'was paid against — newest credit first, newest payment first within each. Only ' +
          'deals that have at least one payment appear; a signed credit nobody has paid yet ' +
          'is absent. Amounts are in som. Paged 1-based over DEALS (not payments), so each ' +
          'returned deal always carries its complete payment history and `paidTotal` always ' +
          'equals the sum of the `payments` beneath it. `total` counts deals. For a flat ' +
          'chronological feed with a date filter, use GET /client/payments.',
        security: SECURITY,
        querystring: ListQuery,
        response: {
          200: Type.Object({
            deals: Type.Array(DealGroup),
            // Echoes the page actually requested — including one past the end,
            // where `deals` is empty and page > lastPage.
            page: Type.Integer(),
            // Always >= 1, so an empty history reads "1 of 1", not "1 of 0".
            lastPage: Type.Integer(),
            // Number of DEALS with payments, not the payment count.
            total: Type.Integer(),
          }),
          400: ERROR,
          401: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request) => {
      const userId = Number(request.user.sub);
      const page = request.query.page ?? 1;

      const { rows, total, lastPage } = await listClientPaymentsByDeal({
        userId,
        page,
        limit: request.query.limit ?? DEFAULT_LIMIT,
      });

      return {
        page,
        lastPage,
        total,
        deals: rows.map((d) => ({
          dealId: d.dealId,
          // Sent as a string to match GET /client/payments and /client/deals,
          // so the app parses this field one way everywhere.
          dealNumber: String(d.dealNumber),
          status: d.status,
          merchantName: d.merchantName ?? '—',
          totalPayable: d.totalPayable ?? 0,
          paidTotal: d.paidTotal,
          payments: d.payments.map((p) => ({
            id: p.id.toString(),
            amount: Number(p.amount),
            source: p.source,
            paymentType: p.paymentType,
            createdAt: p.createdAt.toISOString(),
          })),
        })),
      };
    },
  );
}
