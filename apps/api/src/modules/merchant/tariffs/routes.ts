import type { FastifyInstance } from 'fastify';
import { listTariffsForMerchant } from './queries/list-tariffs';

type MerchantPayload = { sub: string; merchantId: string; role: string };

function merchantId(request: { user: unknown }) {
  return BigInt((request.user as MerchantPayload).merchantId);
}

export default async function merchantTariffRoutes(app: FastifyInstance) {
  const db = app.db;
  const preHandler = app.verifyMerchantJwt;

  app.get('/', { preHandler }, async (request) => {
    const rows = await listTariffsForMerchant(db, merchantId(request));
    return {
      tariffs: rows.map((t) => ({
        id: t.id.toString(),
        name: t.name,
        termMonths: t.termMonths,
        markupPercent: parseFloat(t.markupPercent),
        active: t.active,
      })),
    };
  });
}
