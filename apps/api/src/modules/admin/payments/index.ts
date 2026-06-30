import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { listPayments } from './queries/list-payments/list-payments.handler';
import { listManualPayments } from './queries/list-manual-payments/list-manual-payments.handler';
import { searchDealsForManualPayment } from './queries/search-deals/search-deals.handler';
import { createManualPayment } from './commands/create-manual-payment/create-manual-payment.handler';

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

  fastify.get('/manual', { schema: { tags: TAGS }, preHandler }, async () => {
    const payments = await listManualPayments();
    return { payments };
  });

  const CreateBody = Type.Object({
    dealId: Type.String({ format: 'uuid' }),
    amount: Type.Integer({ minimum: 1 }),
    paymentType: Type.Union([Type.Literal('mib'), Type.Literal('transfer')]),
    note: Type.Optional(Type.String()),
  });

  fastify.post('/manual', { schema: { tags: TAGS, body: CreateBody }, preHandler }, async (request, reply) => {
    const adminUserId = Number((request.user as { sub: string }).sub);
    try {
      const payment = await createManualPayment({ ...request.body, adminUserId });
      return reply.status(201).send({ payment });
    } catch (err: any) {
      if (err.code === 'OVERPAYMENT') {
        return reply.status(400).send({ code: 'OVERPAYMENT', message: err.message });
      }
      throw err;
    }
  });
}
