import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { createDealFromSession } from './commands/create-deal/create-deal.handler';
import { loadOwnedActiveSession } from '../deal-sessions/queries/load-owned-active-session/load-owned-active-session.handler';
import { listDeals } from './queries/list-deals/list-deals.handler';
import { getDealById } from './queries/get-deal/get-deal.handler';
import { getContractPdfUrl } from './queries/get-contract-pdf-url/get-contract-pdf-url.handler';
import { notifyDealCreated, notifyDealDecision } from '../../notifications/service/service.handler';

type JwtPayload = {
  sub: string;
  merchantId: string;
  branchId: string;
  role: string;
};

function payload(request: { user: unknown }) {
  return request.user as JwtPayload;
}

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, '0')}` : '—';
}

export default async function merchantDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  /* ── Body schemas ──────────────────────────────────────────────────────── */

  // The Deal is built FROM the Deal Session (ADR-0024): basket, tariff,
  // payment day, lang and scoring are read from step_data written server-side
  // during the Wizard run. The body carries only the run id + consent proof.
  const CreateDealBody = Type.Object({
    dealSessionId: Type.String({ minLength: 1 }),
    signingToken: Type.String({ minLength: 1 }),
  });

  const IdParams = Type.Object({ id: Type.String() });

  const ListDealsQuery = Type.Object({
    sortBy: Type.Optional(
      Type.Union([Type.Literal('status'), Type.Literal('amount'), Type.Literal('createdAt')]),
    ),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  });

  /* ── POST / — create deal ─────────────────────────────────────────────── */

  fastify.post(
    '/',
    {
      schema: { body: CreateDealBody },
      preHandler: [app.verifyMerchantJwt, app.requirePermission('create_deal')],
    },
    async (request, reply) => {
      const p = payload(request);

      let signingPayload: { phone: string; purpose: string };
      try {
        signingPayload = app.jwt.verify<{ phone: string; purpose: string }>(
          request.body.signingToken,
        );
      } catch {
        return reply.code(400).sendError('invalid_signing_token');
      }

      if (signingPayload.purpose !== 'deal_signing') {
        return reply.code(400).sendError('invalid_signing_purpose');
      }

      let deal: Awaited<ReturnType<typeof createDealFromSession>>;
      try {
        const session = await loadOwnedActiveSession(request.body.dealSessionId, Number(p.sub));
        deal = await createDealFromSession(session);
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        if (err.code === 'session_incomplete')
          return reply.code(409).sendError('session_incomplete');
        if (err.code === 'scoring_missing') return reply.code(409).sendError('scoring_missing');
        if (err.code === 'scoring_declined') return reply.code(409).sendError('scoring_declined');
        if (err.code === 'product_not_found') return reply.code(400).sendError('product_not_found');
        if (err.code === 'amount_below_tariff_min')
          return reply.code(400).sendError('amount_below_tariff_min');
        if (err.code === 'amount_above_tariff_max')
          return reply.code(400).sendError('amount_above_tariff_max');
        throw err;
      }

      const scoringDecision = deal.scoringDecision;

      notifyDealCreated({
        dealId: deal.id,
        agentId: +p.sub,
        merchantId: +p.merchantId,
        branchId: +p.branchId,
        userId: deal.userId,
        amountTiyin: deal.amount,
      }).catch((err) => app.log.warn({ err }, 'notifyDealCreated failed'));

      notifyDealDecision({
        dealId: deal.id,
        userId: deal.userId ?? Number(0),
        scoringDecision: scoringDecision ?? null,
        lang: deal.lang as 'ru' | 'uz',
      }).catch((err) => app.log.warn({ err }, 'notifyDealDecision failed'));

      return reply
        .code(201)
        .send({ dealId: deal.id, dealNumber: formatDealNumber(deal.dealNumber) });
    },
  );

  /* ── GET / — list deals ───────────────────────────────────────────────── */

  fastify.get(
    '/',
    { schema: { querystring: ListDealsQuery }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const p = payload(request);
      const merchantId = Number(p.merchantId);
      const agentId = p.role === 'agent' ? Number(p.sub) : undefined;
      const { sortBy, sortOrder } = request.query as { sortBy?: string; sortOrder?: string };
      const list = await listDeals(merchantId, agentId, { sortBy, sortOrder });
      return { deals: list };
    },
  );

  /* ── GET /:id — deal detail ───────────────────────────────────────────── */

  fastify.get(
    '/:id',
    { schema: { params: IdParams }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request);
      const merchantId = Number(p.merchantId);
      const result = await getDealById(request.params.id, merchantId);
      if (!result) return reply.code(404).sendError('deal_not_found');
      const { schedule: _schedule, ...deal } = result;
      return { deal };
    },
  );

  /* ── GET /:id/contract-pdf — get or generate Kontrakt PDF ────────────── */

  fastify.get(
    '/:id/contract-pdf',
    { schema: { params: IdParams }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const p = payload(request);
      const merchantId = Number(p.merchantId);
      try {
        const url = await getContractPdfUrl({ dealId: request.params.id, merchantId });
        return { url };
      } catch (err: any) {
        if (err.statusCode === 404) return reply.code(404).sendError('deal_not_found');
        throw err;
      }
    },
  );
}
