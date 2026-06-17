import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { getBranch } from './queries/get-branch/get-branch.handler';
import { updateBranch } from './commands/update-branch/update-branch.handler';
import { listEmployees } from '../employees/queries/list-employees';
import { createEmployee } from '../employees/commands/create-employee';

function serializeBranch(b: NonNullable<Awaited<ReturnType<typeof getBranch>>>) {
  return { ...b, id: b.id.toString(), merchantId: b.merchantId.toString() };
}

function serializeEmployee(e: NonNullable<Awaited<ReturnType<typeof createEmployee>>>) {
  return {
    ...e,
    id: e.id.toString(),
    merchantId: e.merchantId.toString(),
    branchId: e.branchId.toString(),
  };
}

export default async function adminBranchRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const IdParams = Type.Object({ id: Type.String() });

  const UpdateBranchBody = Type.Partial(
    Type.Object({
      name: Type.String({ minLength: 1 }),
      address: Type.String({ minLength: 1 }),
      phone: Type.String({ minLength: 1 }),
      active: Type.Boolean(),
    }),
  );

  const CreateEmployeeBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 8 }),
    fullName: Type.String({ minLength: 1 }),
    roles: Type.Array(Type.Union([Type.Literal('agent'), Type.Literal('merchant_admin')]), {
      minItems: 1,
    }),
  });

  const preHandler = app.verifyAdminJwt;

  fastify.get('/:id', { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    const branch = await getBranch(+request.params.id);
    if (!branch) return reply.code(404).sendError('not_found');
    return { branch: serializeBranch(branch) };
  });

  fastify.patch(
    '/:id',
    { schema: { params: IdParams, body: UpdateBranchBody }, preHandler },
    async (request, reply) => {
      const branch = await updateBranch({ id: +request.params.id, ...request.body });
      if (!branch) return reply.code(404).sendError('not_found');
      return { branch: serializeBranch(branch) };
    },
  );

  fastify.get('/:id/employees', { schema: { params: IdParams }, preHandler }, async (request) => {
    const rows = await listEmployees(db, Number(request.params.id));
    return { employees: rows.map(serializeEmployee) };
  });

  fastify.post(
    '/:id/employees',
    { schema: { params: IdParams, body: CreateEmployeeBody }, preHandler },
    async (request, reply) => {
      const branch = await getBranch(+request.params.id);
      if (!branch) return reply.code(404).sendError('not_found');
      const employee = await createEmployee(db, {
        phone: request.body.phone,
        password: request.body.password,
        fullName: request.body.fullName,
        merchantId: branch.merchantId,
        branchId: branch.id,
        roles: request.body.roles,
      });
      return reply.code(201).send({ employee: serializeEmployee(employee) });
    },
  );
}
