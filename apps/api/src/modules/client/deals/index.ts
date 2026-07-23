import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@db';
import { deals, dealItems, merchants } from '@db/schema';
import { buildMerchantLogoUrl } from '../../../lib/merchant-logo';
import { StringEnum } from '@lib/typebox';
import { buildPaymeCheckoutUrl } from '../../integrations/payme/checkout';
import { PAYME_MIN_PAYMENT_SOM } from '../../integrations/payme/account';
import { loadProgressForDeals, loadDealSchedule } from './progress';

// ---------------------------------------------------------------------------
// Client Deals — a borrower's own credits in the mobile app. Scoped to the
// authenticated user (request.user.sub); a client only ever sees deals they
// signed. Visibility is limited to states that represent a real financial
// obligation — active/overdue/closed — so pipeline/pre-signing states
// (draft/scoring/approved/declined) never surface here. Money is in som.
// ---------------------------------------------------------------------------

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

// The one visibility rule shared by list and detail. A deal outside this set —
// or belonging to another user — is invisible through BOTH endpoints.
const VISIBLE_STATUSES = ['active', 'overdue', 'closed', 'declined'] as const;

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : '—';
}

export default async function clientDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Deals'];
  const guards = [app.verifyClientJwt];

  const StatusEnum = StringEnum(VISIBLE_STATUSES);

  const Progress = {
    paidAmount: Type.Number(),
    remainingAmount: Type.Number(),
    nextDueDate: Type.Union([Type.String(), Type.Null()]),
    nextDueAmount: Type.Union([Type.Number(), Type.Null()]),
  };

  const DealListItem = Type.Object({
    id: Type.String(),
    dealNumber: Type.String(),
    status: Type.String(),
    createdAt: Type.String(),
    merchantName: Type.String(),
    // Absolute, publicly fetchable; null when the merchant has no logo, in which
    // case the app falls back to its own placeholder.
    merchantLogoUrl: Type.Union([Type.String(), Type.Null()]),
    totalPayable: Type.Number(),
    termMonths: Type.Integer(),
    ...Progress,
  });

  const ListQuery = Type.Object({ status: Type.Optional(StatusEnum) });

  /* ── GET /client/deals — the authenticated client's own credits ────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List my deals',
        description: "The authenticated client's active, overdue and closed credits.",
        security: SECURITY,
        querystring: ListQuery,
        response: { 200: Type.Object({ deals: Type.Array(DealListItem) }), 401: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      const userId = Number(request.user.sub);
      const { status } = request.query;

      const statusFilter = status
        ? eq(deals.status, status)
        : inArray(deals.status, [...VISIBLE_STATUSES]);

      const rows = await db
        .select({
          deal: deals,
          merchantId: merchants.id,
          merchantName: merchants.name,
          merchantLogoFileId: merchants.logoFileId,
        })
        .from(deals)
        .leftJoin(merchants, eq(deals.merchantId, merchants.id))
        .where(and(eq(deals.userId, userId), statusFilter))
        .orderBy(desc(deals.createdAt));

      const progress = await loadProgressForDeals(rows.map((r) => r.deal.id));

      const list = rows.map((r) => {
        const p = progress.get(r.deal.id)!;
        return {
          id: r.deal.id,
          dealNumber: formatDealNumber(r.deal.dealNumber),
          status: r.deal.status,
          createdAt: r.deal.createdAt.toISOString(),
          merchantName: r.merchantName ?? '—',
          merchantLogoUrl: r.merchantId
            ? buildMerchantLogoUrl(r.merchantId, r.merchantLogoFileId)
            : null,
          totalPayable: r.deal.totalPayable ?? 0,
          termMonths: r.deal.termMonths ?? 0,
          ...p,
        };
      });

      return { deals: list };
    },
  );

  /* ── GET /client/deals/:id — one credit with basket + schedule ─────────── */

  const IdParams = Type.Object({ id: Type.String() });

  const BasketItem = Type.Object({
    productName: Type.String(),
    price: Type.Number(),
    quantity: Type.Integer(),
  });

  const ScheduleItem = Type.Object({
    index: Type.Integer(),
    dueDate: Type.String(),
    amount: Type.Number(),
    paidAmount: Type.Number(),
    paid: Type.Boolean(),
    paidAt: Type.Union([Type.String(), Type.Null()]),
  });

  const DealDetail = Type.Object({
    id: Type.String(),
    dealNumber: Type.String(),
    status: Type.String(),
    createdAt: Type.String(),
    lang: Type.String(),
    merchantName: Type.String(),
    merchantLogoUrl: Type.Union([Type.String(), Type.Null()]),
    termMonths: Type.Integer(),
    paymentDay: Type.Union([Type.Integer(), Type.Null()]),
    amount: Type.Number(),
    totalPayable: Type.Number(),
    prepaymentAmount: Type.Number(),
    ...Progress,
    basket: Type.Array(BasketItem),
    schedule: Type.Array(ScheduleItem),
  });

  fastify.get(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Get my deal',
        description:
          "One of the authenticated client's own credits, with basket and payment schedule.",
        security: SECURITY,
        params: IdParams,
        response: { 200: Type.Object({ deal: DealDetail }), 401: ERROR, 404: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);

      const rows = await db
        .select({
          deal: deals,
          merchantId: merchants.id,
          merchantName: merchants.name,
          merchantLogoFileId: merchants.logoFileId,
        })
        .from(deals)
        .leftJoin(merchants, eq(deals.merchantId, merchants.id))
        // Same visibility rule as the list — ownership AND status. A miss is a
        // 404 (never 403): a deal that isn't the client's must not be
        // distinguishable from one that doesn't exist.
        .where(
          and(
            eq(deals.id, request.params.id),
            eq(deals.userId, userId),
            inArray(deals.status, [...VISIBLE_STATUSES]),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row) return reply.code(404).sendError('deal_not_found');
      const { deal } = row;

      const [itemRows, sched] = await Promise.all([
        db.select().from(dealItems).where(eq(dealItems.dealId, deal.id)).orderBy(dealItems.id),
        loadDealSchedule(deal.id),
      ]);

      return {
        deal: {
          id: deal.id,
          dealNumber: formatDealNumber(deal.dealNumber),
          status: deal.status,
          createdAt: deal.createdAt.toISOString(),
          lang: deal.lang ?? 'ru',
          merchantName: row.merchantName ?? '—',
          merchantLogoUrl: row.merchantId
            ? buildMerchantLogoUrl(row.merchantId, row.merchantLogoFileId)
            : null,
          termMonths: deal.termMonths ?? 0,
          paymentDay: deal.paymentDay ?? null,
          amount: deal.amount ?? 0,
          totalPayable: deal.totalPayable ?? 0,
          prepaymentAmount: deal.prepaymentAmount ?? 0,
          ...sched.progress,
          basket: itemRows.map((i) => ({
            productName: i.productName,
            price: Number(i.price),
            quantity: i.quantity,
          })),
          schedule: sched.schedule,
        },
      };
    },
  );

  /* ── GET /client/deals/:id/payme-link — checkout URL for this deal ─────── */

  const PaymeLink = Type.Object({
    url: Type.String(),
    // What we prefilled, in som. The payer can change it on Payme's screen —
    // this is a convenience, never a commitment. CheckPerformTransaction is the
    // only place an amount is actually agreed to.
    suggestedAmount: Type.Number(),
  });

  fastify.get(
    '/:id/payme-link',
    {
      schema: {
        tags: TAGS,
        summary: 'Payme checkout link',
        description:
          "A Payme checkout URL for one of the caller's own deals, prefilled with the deal " +
          'number and the next instalment. Deep-links into the Payme app when installed. ' +
          'Stateless — nothing is reserved by calling this.',
        security: SECURITY,
        params: IdParams,
        response: { 200: PaymeLink, 401: ERROR, 404: ERROR, 409: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);

      const rows = await db
        .select({
          id: deals.id,
          dealNumber: deals.dealNumber,
          status: deals.status,
          lang: deals.lang,
        })
        .from(deals)
        .where(and(eq(deals.id, request.params.id), eq(deals.userId, userId)))
        .limit(1);

      const deal = rows[0];
      if (!deal) return reply.code(404).sendError('deal_not_found');
      // Only a deal carrying debt can be paid. A closed one is a 409 rather than
      // a 404 — the client can see it in their list, so pretending it is missing
      // would be more confusing than saying there is nothing to pay.
      if (deal.status !== 'active' && deal.status !== 'overdue') {
        return reply.code(409).sendError('deal_not_payable');
      }

      const sched = await loadDealSchedule(deal.id);
      const { nextDueAmount, remainingAmount } = sched.progress;

      // Prefill the next instalment, which is what all but a handful of payers
      // want. Fall back to the whole remaining debt when the next instalment is
      // a stub below the minimum we accept — offering an amount that
      // CheckPerformTransaction would reject is worse than offering none.
      const suggested =
        nextDueAmount && nextDueAmount >= PAYME_MIN_PAYMENT_SOM ? nextDueAmount : remainingAmount;

      const url = buildPaymeCheckoutUrl({
        dealNumber: deal.dealNumber,
        amountSom: suggested,
        lang: deal.lang === 'uz' ? 'uz' : 'ru',
      });
      // Null means no cashbox is configured for this environment.
      if (!url) return reply.code(409).sendError('payme_not_configured');

      return { url, suggestedAmount: suggested };
    },
  );
}
