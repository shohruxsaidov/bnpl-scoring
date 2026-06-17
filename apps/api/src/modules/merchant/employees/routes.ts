import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { listEmployees } from './queries/list-employees';
import { createEmployee } from './commands/create-employee';
import { updateEmployee } from './commands/update-employee';

type MerchantPayload = { merchantId: string; role: string };

function merchantId(request: { user: unknown }) {
  return +(request.user as MerchantPayload).merchantId;
}

function serialize(e: NonNullable<Awaited<ReturnType<typeof createEmployee>>>) {
  return {
    ...e,
    id: e.id.toString(),
    merchantId: e.merchantId.toString(),
    branchId: e.branchId.toString(),
  };
}

export default async function merchantEmployeeRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;
  const preHandler = app.verifyMerchantJwt;
  const manage = [app.verifyMerchantJwt, app.requirePermission('manage_employees')];

  const IdParams = Type.Object({ id: Type.String() });

  // A Merchant Admin may only create/manage Agents — elevated roles are
  // provisioned from the admin platform.
  const CreateBody = Type.Object({
    phone: Type.String({ minLength: 7 }),
    password: Type.String({ minLength: 8 }),
    fullName: Type.String({ minLength: 1 }),
    branchId: Type.String(),
    roles: Type.Array(Type.Literal('agent'), { minItems: 1, maxItems: 1 }),
  });

  const UpdateBody = Type.Partial(
    Type.Object({
      fullName: Type.String({ minLength: 1 }),
      branchId: Type.String(),
      roles: Type.Array(Type.Literal('agent'), { minItems: 1, maxItems: 1 }),
      active: Type.Boolean(),
    }),
  );

  fastify.get('/', { preHandler }, async (request) => {
    const rows = await listEmployees(db, merchantId(request));
    return { employees: rows.map(serialize) };
  });

  fastify.post(
    '/',
    { schema: { body: CreateBody }, preHandler: manage },
    async (request, reply) => {
      const employee = await createEmployee(db, {
        phone: request.body.phone,
        password: request.body.password,
        fullName: request.body.fullName,
        merchantId: merchantId(request),
        branchId: +request.body.branchId,
        roles: request.body.roles,
      });
      return reply.code(201).send({ employee: serialize(employee) });
    },
  );

  fastify.patch(
    '/:id',
    { schema: { params: IdParams, body: UpdateBody }, preHandler: manage },
    async (request, reply) => {
      const input = {
        ...request.body,
        branchId: request.body.branchId ? Number(request.body.branchId) : undefined,
      };
      const employee = await updateEmployee(
        db,
        +request.params.id,
        merchantId(request),
        input,
      );
      if (!employee) return reply.code(404).sendError('not_found');
      return { employee: serialize(employee) };
    },
  );
}
