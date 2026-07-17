import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { buildMerchantLogoUrl } from '../../../lib/merchant-logo';
import {
  getVisibleMerchant,
  listActiveBranches,
  listVisibleMerchants,
} from './queries';

// The client-facing merchant catalog: "which shops accept us, and where are
// they". Everything here is a storefront fact. The merchant record also carries
// inn / mfo / accountNumber / bankName / legalName / contractNumber /
// scoringModelId — counterparty banking and risk internals that must never reach
// a mobile client, so these responses are built from an explicit field list
// rather than by spreading a row.
//
// The merchant's own `address` is excluded too: it is the legal/office address,
// not a place a client can visit. Branches are the addresses that matter.

const TAGS = ['Client · Merchants'];
const SECURITY = [{ clientAuth: [] }];
const XLANG = [{ $ref: '#/components/parameters/xLang' }];
const ERROR = { $ref: 'ErrorResponse#' };

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

// Mirrors toListItem(): ids are emitted as strings.
const MerchantListItem = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    logoUrl: Type.Union([Type.String(), Type.Null()]),
    branchCount: Type.Integer(),
  },
  {
    examples: [
      {
        id: '12',
        name: 'Korzinka',
        logoUrl: 'https://api.example.com/api/v1/public/merchants/12/logo?v=88',
        branchCount: 14,
      },
    ],
  },
);

// Coordinates are nullable as a pair — set together, cleared together (see
// db/branches.ts). A client should treat a null pair as "no pin on the map",
// never as a half-located branch.
const Branch = Type.Object({
  id: Type.String(),
  name: Type.String(),
  address: Type.String(),
  phone: Type.String(),
  latitude: Type.Union([Type.Number(), Type.Null()]),
  longitude: Type.Union([Type.Number(), Type.Null()]),
});

const MerchantDetail = Type.Object({
  id: Type.String(),
  name: Type.String(),
  logoUrl: Type.Union([Type.String(), Type.Null()]),
  branches: Type.Array(Branch),
});

function toListItem(row: {
  id: number;
  name: string;
  logoFileId: number | null;
  branchCount: number;
}) {
  return {
    id: row.id.toString(),
    name: row.name,
    logoUrl: buildMerchantLogoUrl(row.id, row.logoFileId),
    branchCount: row.branchCount,
  };
}

function toBranch(b: Awaited<ReturnType<typeof listActiveBranches>>[number]) {
  return { ...b, id: b.id.toString() };
}

export default async function clientMerchantRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const guards = [app.verifyClientJwt];

  const ListQuery = Type.Object({
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_LIMIT })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
    q: Type.Optional(Type.String()),
  });

  // Serial ids, matching the client convention (see client/cards). The pattern
  // turns a junk path into a 400 rather than a NaN reaching the query.
  const IdParams = Type.Object({ id: Type.String({ pattern: '^\\d+$' }) });

  /* ── GET /client/merchants — the catalog ────────────────────────────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List merchants',
        description:
          'Merchants a client can shop at: active, not hidden from the app, and ' +
          'having at least one active branch. `q` filters by merchant name. ' +
          '`total` is the number of merchants matching the filter, not the ' +
          'catalog size.',
        security: SECURITY,
        parameters: XLANG,
        querystring: ListQuery,
        response: {
          200: Type.Object({
            merchants: Type.Array(MerchantListItem),
            total: Type.Integer(),
          }),
          400: ERROR,
          401: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request) => {
      const { rows, total } = await listVisibleMerchants({
        limit: request.query.limit ?? DEFAULT_LIMIT,
        offset: request.query.offset ?? 0,
        q: request.query.q,
      });
      return { merchants: rows.map(toListItem), total };
    },
  );

  /* ── GET /client/merchants/:id — one merchant and its branches ──────────── */

  fastify.get(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Get merchant',
        description:
          'Returns a merchant with all of its active branches. Branches are ' +
          'embedded in full rather than paginated. A merchant hidden from the ' +
          'catalog responds 404, identically to one that does not exist.',
        security: SECURITY,
        parameters: XLANG,
        params: IdParams,
        response: {
          200: Type.Object({ merchant: MerchantDetail }),
          400: ERROR,
          401: ERROR,
          404: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      // Same visibility predicate as the list. A hidden merchant is reported as
      // absent: a distinguishable response would confirm the row exists to
      // anyone walking the id space.
      const merchant = await getVisibleMerchant(id);
      if (!merchant) return reply.code(404).sendError('not_found');

      const branchRows = await listActiveBranches(id);
      return {
        merchant: {
          id: merchant.id.toString(),
          name: merchant.name,
          logoUrl: buildMerchantLogoUrl(merchant.id, merchant.logoFileId),
          branches: branchRows.map(toBranch),
        },
      };
    },
  );
}
