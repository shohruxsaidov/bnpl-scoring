import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { listClientPayments } from './queries';

// ---------------------------------------------------------------------------
// Client Payments — GET /client/payments.
//
// A borrower's own money-in history across every credit they hold, newest
// first, optionally narrowed to a date window. Scoped to request.user.sub; a
// client only ever sees payments booked against their own deals.
// ---------------------------------------------------------------------------

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : '—';
}

export default async function clientPaymentRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Payments'];
  const guards = [app.verifyClientJwt];

  const PaymentItem = Type.Object({
    id: Type.String(),
    dealId: Type.String(),
    dealNumber: Type.String(),
    merchantName: Type.String(),
    /** In som. */
    amount: Type.Number(),
    // How the money was initiated, not how it arrived: 'payme' is a client-side
    // checkout, 'manual' an admin recording a transfer they received.
    source: Type.Union([Type.Literal('manual'), Type.Literal('payme')]),
    // The sub-kind behind `source`: 'mib' | 'transfer' for a manual row, or the
    // rail's own name ('payme') for a machine-booked one. Left open as a string
    // rather than a union — the column is free text, and a new rail must not
    // make an existing payment fail response validation and vanish from the
    // history.
    paymentType: Type.String(),
    createdAt: Type.String(),
  });

  const ListQuery = Type.Object({
    // Full instants, not calendar dates. The app owns the timezone — it sends
    // e.g. 2026-07-01T00:00:00+05:00 — so no offset is assumed server-side.
    // Both bounds are inclusive.
    from: Type.Optional(Type.String({ format: 'date-time' })),
    to: Type.Optional(Type.String({ format: 'date-time' })),
    // 1-based paging. This endpoint takes `page`, never `offset` — the sibling
    // client endpoints still speak offset, but there is one way to page here.
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_LIMIT })),
  });

  /* ── GET /client/payments — the authenticated client's payment history ─── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List my payments',
        description:
          "Every payment the authenticated client has made, across all their credits, " +
          'newest first. One row per money-in event — not per instalment; for the ' +
          'schedule of what is still owed, use GET /client/deals/:id. `from`/`to` are ' +
          'inclusive ISO date-times carrying the caller’s UTC offset. Amounts are in som. ' +
          'Paged 1-based via `page`: the response echoes the requested `page` and reports ' +
          '`lastPage`, so a page past the end returns an empty list with page > lastPage ' +
          'rather than silently re-serving the final page.',
        security: SECURITY,
        querystring: ListQuery,
        response: {
          200: Type.Object({
            payments: Type.Array(PaymentItem),
            // Echoes the page actually requested — including one past the end,
            // where `payments` is empty and page > lastPage.
            page: Type.Integer(),
            // Always >= 1, so an empty history reads "1 of 1", not "1 of 0".
            lastPage: Type.Integer(),
            // Matches the filter, not the whole history.
            total: Type.Integer(),
          }),
          400: ERROR,
          401: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const { from, to } = request.query;

      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;

      // An inverted window is a client bug, and returning an empty list for it
      // reads as "you made no payments" — which is the one lie this endpoint
      // must not tell.
      if (fromDate && toDate && fromDate > toDate) {
        return reply.code(400).sendError('invalid_date_range');
      }

      const page = request.query.page ?? 1;

      const { rows, total, lastPage } = await listClientPayments({
        userId,
        page,
        limit: request.query.limit ?? DEFAULT_LIMIT,
        from: fromDate,
        to: toDate,
      });

      return {
        page,
        lastPage,
        payments: rows.map((r) => ({
          id: r.id.toString(),
          dealId: r.dealId,
          dealNumber: formatDealNumber(r.dealNumber),
          merchantName: r.merchantName ?? '—',
          amount: Number(r.amount),
          source: r.source,
          paymentType: r.paymentType,
          createdAt: r.createdAt.toISOString(),
        })),
        total,
      };
    },
  );
}
