import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { users } from '@db/schema';
import { findUserById } from '../../auth/client/service/service.handler';
import { env } from '@env';

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

// Mirrors toProfile(): bigint id is emitted as a string. The full-object
// `examples` entry is what Swagger UI renders as the sample response body.
const Profile = Type.Object(
  {
    id: Type.String(),
    pinfl: Type.String(),
    firstName: Type.String(),
    lastName: Type.String(),
    middleName: Type.Union([Type.String(), Type.Null()]),
    phone: Type.String(),
    birthDate: Type.Union([Type.String(), Type.Null()]),
    gender: Type.Union([Type.Integer(), Type.Null()]),
    nationality: Type.Union([Type.String(), Type.Null()]),
    passportSeries: Type.Union([Type.String(), Type.Null()]),
    passportNumber: Type.Union([Type.String(), Type.Null()]),
    photoUrl: Type.Union([Type.String(), Type.Null()]),
    address: Type.Union([Type.String(), Type.Null()]),
    regionCode: Type.Union([Type.String(), Type.Null()]),
    districtCode: Type.Union([Type.String(), Type.Null()]),
    docType: Type.Union([Type.Integer(), Type.Null()]),
  },
  {
    examples: [
      {
        id: '1042',
        pinfl: '12345678901234',
        firstName: 'ALISHER',
        lastName: 'KARIMOV',
        middleName: 'BAXTIYOROVICH',
        phone: '998991234567',
        birthDate: '1990-05-14',
        gender: 1,
        nationality: 'UZB',
        passportSeries: 'AA',
        passportNumber: '1234567',
        photoUrl: 'https://cdn.example.com/photos/1042.jpg',
        address: 'Toshkent sh., Chilonzor tumani',
        regionCode: '10',
        districtCode: '1027',
        docType: 1,
      },
    ],
  },
);

// Authenticated client profile. `/me` is an aggregate: for now it returns only
// { profile }, but the envelope leaves room for sibling sections (limits, active
// deal, verification) to be added without a breaking change. Guarded by the
// client JWT — user id comes from request.user.sub.

function toProfile(c: typeof users.$inferSelect) {
  let photoUrl: string | null = null;
  if (c.photoId) {
    photoUrl = `https://${env.MINIO_PUBLIC_ENDPOINT}/public/${c.photoId}`;
  }
  return {
    id: c.id.toString(),
    pinfl: c.pinfl,
    firstName: c.firstName,
    lastName: c.lastName,
    middleName: c.middleName,
    phone: c.phone,
    birthDate: c.birthDate,
    gender: c.gender,
    nationality: c.nationality,
    passportSeries: c.passportSeries,
    passportNumber: c.passportNumber,
    photoUrl,
    address: c.address,
    regionCode: c.regionCode,
    districtCode: c.districtCode,
    docType: c.docType,
  };
}

export default async function clientMeRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Me'];
  const guards = [app.verifyClientJwt];

  /* ── GET /client/me — the authenticated client's own profile ───────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Get my profile',
        description: "Returns the authenticated client's own profile.",
        security: SECURITY,
        response: {
          200: Type.Object({ profile: Profile }),
          401: ERROR,
          404: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const user = await findUserById(Number(request.user.sub));
      if (!user) return reply.code(404).sendError('user_not_found');
      return { profile: toProfile(user) };
    },
  );
}
