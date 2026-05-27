import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { deselectTariff, listTariffsForMerchant, selectTariff } from './service.js';

type MerchantPayload = { sub: string; merchantId: string; role: string };

function merchantId(request: { user: unknown }) {
  return BigInt((request.user as MerchantPayload).merchantId);
}

function isAdmin(request: { user: unknown }) {
  return (request.user as MerchantPayload).role === 'merchant_admin';
}

export default async function merchantTariffRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;
  const preHandler = app.verifyMerchantJwt;

  const IdParams = Type.Object({ id: Type.String() });

  fastify.get('/', { preHandler }, async (request) => {
    const rows = await listTariffsForMerchant(db, merchantId(request));
    return {
      tariffs: rows.map((t) => ({
        id: t.id.toString(),
        name: t.name,
        termMonths: t.termMonths,
        markupPercent: parseFloat(t.markupPercent),
        creditMin: Number(t.creditMin),
        creditMax: Number(t.creditMax),
        active: t.active,
        selected: true,
      })),
    };
  });

  fastify.post('/:id', { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ code: 'forbidden' });
    await selectTariff(db, merchantId(request), BigInt(request.params.id));
    return reply.code(204).send();
  });

  fastify.delete('/:id', { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ code: 'forbidden' });
    await deselectTariff(db, merchantId(request), BigInt(request.params.id));
    return reply.code(204).send();
  });
}
