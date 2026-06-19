import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { calcTotalPayable, splitInstallments } from '../../deals/installments';
import { listTariffsForMerchant } from './queries/list-tariffs/list-tariffs.handler';

type MerchantPayload = { sub: string; merchantId: string; role: string };

function merchantId(request: { user: unknown }) {
  return +(request.user as MerchantPayload).merchantId;
}

export default async function merchantTariffRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const preHandler = app.verifyMerchantJwt;

  fastify.get('/', { preHandler }, async (request) => {
    const rows = await listTariffsForMerchant(merchantId(request));
    return {
      tariffs: rows.map((t) => ({
        id: t.id.toString(),
        name: t.name,
        termMonths: t.termMonths,
        markupPercent: parseFloat(t.markupPercent),
        minAmount: t.minAmount != null ? Number(t.minAmount) : null,
        maxAmount: t.maxAmount != null ? Number(t.maxAmount) : null,
        active: t.active,
      })),
    };
  });

  /* ── GET /quote — Tariff Calculator: quote one amount across all tariffs ── */

  const QuoteQuery = Type.Object({
    amount: Type.Integer({ minimum: 1 }), // tiyin
  });

  fastify.get(
    '/quote',
    {
      schema: { querystring: QuoteQuery },
      preHandler: [app.verifyMerchantJwt, app.requirePermission('create_deal')],
    },
    async (request) => {
      const amount = Number(request.query.amount);
      const rows = await listTariffsForMerchant(merchantId(request));

      return {
        amount: request.query.amount,
        quotes: rows.map((t) => {
          const markupPercent = parseFloat(t.markupPercent);
          const totalPayable = calcTotalPayable(amount, markupPercent);
          const installments = splitInstallments(totalPayable, t.termMonths);
          const inRange =
            (t.minAmount == null || amount >= Number(t.minAmount)) &&
            (t.maxAmount == null || amount <= Number(t.maxAmount));
          return {
            tariffId: t.id.toString(),
            name: t.name,
            termMonths: t.termMonths,
            markupPercent,
            minAmount: t.minAmount != null ? Number(t.minAmount) : null,
            maxAmount: t.maxAmount != null ? Number(t.maxAmount) : null,
            inRange,
            totalPayable: Number(totalPayable),
            ustamaAmount: Number(totalPayable - amount),
            monthlyAmount: installments[0] ?? 0,
            lastMonthlyAmount: installments[installments.length - 1] ?? 0,
            installments,
          };
        }),
      };
    },
  );
}
