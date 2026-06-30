import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { listBlacklist } from './queries/list-blacklist/list-blacklist.handler';
import { getAdminById } from './queries/get-admin/get-admin.handler';
import { addBlacklistEntry } from './commands/add-to-blacklist/add-to-blacklist.handler';
import { removeBlacklistEntry } from './commands/remove-from-blacklist/remove-from-blacklist.handler';

function serialize(row: {
  id: number;
  type: string;
  value: string;
  reason: string | null;
  addedByAdminId: number;
  addedByName: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id.toString(),
    type: row.type,
    value: row.value,
    reason: row.reason ?? null,
    addedByAdminId: row.addedByAdminId.toString(),
    addedByName: row.addedByName ?? 'Unknown',
    createdAt: row.createdAt.toISOString(),
  };
}

const TAGS = ['Admin · Blacklist'];

export default async function adminBlacklistRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const preHandler = app.verifyAdminJwt;

  const IdParams = Type.Object({ id: Type.String() });

  const CreateBody = Type.Object({
    type: Type.Union([Type.Literal('pinfl'), Type.Literal('inn')]),
    value: Type.String({ minLength: 1 }),
    reason: Type.Optional(Type.String()),
  });

  fastify.get('/', { schema: { tags: TAGS }, preHandler }, async () => {
    const rows = await listBlacklist();
    return { entries: rows.map(serialize) };
  });

  fastify.post('/', { schema: { tags: TAGS, body: CreateBody }, preHandler }, async (request, reply) => {
    const adminId = +(request.user as { sub: string }).sub as number;
    const entry = await addBlacklistEntry({
      type: request.body.type,
      value: request.body.value.trim(),
      reason: request.body.reason?.trim() || null,
      addedByAdminId: adminId,
    });
    const admin = await getAdminById(adminId);
    return reply.code(201).send({
      entry: serialize({ ...entry, addedByName: admin?.fullName ?? null }),
    });
  });

  fastify.delete('/:id', { schema: { tags: TAGS, params: IdParams }, preHandler }, async (request, reply) => {
    const entry = await removeBlacklistEntry(+request.params.id);
    if (!entry) return reply.code(404).sendError('not_found');
    return reply.code(204).send();
  });
}
