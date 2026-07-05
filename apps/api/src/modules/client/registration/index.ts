import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { redis } from '@redis';
import { env } from '@env';
import { db } from '@db';
import { users } from '@db/schema';
import { userPublicOfferAcceptances } from '@db/user-public-offer-acceptances';
import { createOtp, verifyOtp, findUserByPinfl } from '../../auth/client/service/service.handler';
import { createMyidSession, exchangeMyidCode } from '../../integrations/myid/client';
import { createUserHandler } from '../../id/users';
import { sendOtpSms } from '../../../lib/sms';
import { getDownloadUrl } from '../../../lib/file-storage';
import { getCurrentPublicOffer, findCurrentPublicOfferById } from './public-offers';
import { pinFailKey } from '../auth/index';

// Self-service client registration (mobile app). Public endpoints — no JWT.
// Mirrors merchant/client otp→myid flow, but anonymous: no merchantId/branchId,
// and myid-complete mints a client session instead of returning a DTO.

const ERROR = { $ref: 'ErrorResponse#' };

const OTP_COOLDOWN_SECONDS = 60;
const OTP_DAILY_LIMIT = 10;
const OTP_DAILY_TTL = 24 * 60 * 60;
const REG_TOKEN_TTL = '15m';

interface RegTokenPhase1 {
  phone: string;
  step: 'phone_verified';
}

interface RegTokenPhase2 {
  phone: string;
  pinfl: string;
  step: 'pinfl_verified';
}

function toClientDto(c: typeof users.$inferSelect) {
  return {
    id: c.id.toString(),
    pinfl: c.pinfl,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    birthDate: c.birthDate,
    gender: c.gender,
    nationality: c.nationality,
    passportSeries: c.passportSeries,
    passportNumber: c.passportNumber,
    photoUrl: c.photoUrl,
    address: c.address,
    regionCode: c.regionCode,
    districtCode: c.districtCode,
    docType: c.docType,
  };
}

export default async function clientRegistrationRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const isProd = env.NODE_ENV === 'production';

  const TAGS = ['Client · Registration'];

  const OtpBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12, examples: ['998991234567'] }),
  });
  const OtpVerifyBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12, examples: ['998991234567'] }),
    code: Type.String({ minLength: 4, maxLength: 4, examples: ['1234'] }),
  });
  const MyidSessionBody = Type.Object({
    regToken: Type.String({ minLength: 1, examples: ['ey.....'] }),
    pinfl: Type.String({
      minLength: 14,
      maxLength: 14,
      pattern: '^\\d{14}$',
      examples: ['12345678901234'],
    }),
  });
  const MyidCompleteBody = Type.Object({
    regToken: Type.String({ minLength: 1, examples: ['ey..'] }),
    myidCode: Type.String({ minLength: 1, examples: ['jfkdjfkd'] }),
    // Id of the public_offers version the client accepted (the row returned by
    // GET /public-offer). Required for new accounts; must be the current version.
    publicOfferId: Type.Integer({ minimum: 1, examples: [1] }),
  });

  /* ── Response schemas (examples power the Swagger UI sample bodies) ──────── */

  const PublicOfferResponse = Type.Object(
    {
      id: Type.Integer(),
      version: Type.Integer(),
      // Freshly-generated presigned download URLs (24h) for the two PDFs of the
      // current version. Accepting the version covers both languages.
      downloadUrlUz: Type.String(),
      downloadUrlRu: Type.String(),
    },
    {
      examples: [
        {
          id: 1,
          version: 3,
          downloadUrlUz: 'https://minio.example.com/bucket/public-offers/....pdf?X-Amz-...',
          downloadUrlRu: 'https://minio.example.com/bucket/public-offers/....pdf?X-Amz-...',
        },
      ],
    },
  );

  const OtpResponse = Type.Object(
    {
      ok: Type.Boolean(),
      // Present only outside production, to ease manual testing.
      devOtp: Type.Optional(Type.String()),
    },
    { examples: [{ ok: true, devOtp: '1234' }] },
  );

  const OtpVerifyResponse = Type.Object(
    { regToken: Type.String() },
    { examples: [{ regToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }] },
  );

  const MyidSessionResponse = Type.Object(
    { regToken: Type.String(), sessionId: Type.String() },
    {
      examples: [
        {
          regToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          sessionId: 'myid_9f3a1c2b7e',
        },
      ],
    },
  );

  // Mirrors toClientDto(): bigint id is emitted as a string.
  const ClientDto = Type.Object({
    id: Type.String(),
    pinfl: Type.String(),
    firstName: Type.String(),
    lastName: Type.String(),
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
  });

  const MyidCompleteResponse = Type.Object(
    {
      // Short-lived onboarding token that authorizes POST /client/auth/setup.
      // No session is created here — the client sets a PIN and activates the
      // device at /setup, which is where the active session is minted.
      regToken: Type.String(),
      client: ClientDto,
    },
    {
      examples: [
        {
          regToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          client: {
            id: '1042',
            pinfl: '12345678901234',
            firstName: 'ALISHER',
            lastName: 'KARIMOV',
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
        },
      ],
    },
  );

  /* ── Current public offer (public, for the accept screen) ────────────────── */

  fastify.get(
    '/public-offer',
    {
      schema: {
        tags: TAGS,
        summary: 'Current public offer',
        description:
          'Returns the current public-offer version with presigned download URLs ' +
          'for the uz and ru PDFs, for the accept screen.',
        response: { 200: PublicOfferResponse, 404: ERROR },
      },
    },
    async (_req, reply) => {
      const offer = await getCurrentPublicOffer();
      if (!offer) return reply.code(404).sendError('public_offer_not_found');
      const [downloadUrlUz, downloadUrlRu] = await Promise.all([
        getDownloadUrl(db, offer.fileUzId),
        getDownloadUrl(db, offer.fileRuId),
      ]);
      return { id: offer.id, version: offer.version, downloadUrlUz, downloadUrlRu };
    },
  );

  /* ── OTP issue ──────────────────────────────────────────────────────────── */

  fastify.post(
    '/otp',
    {
      schema: {
        tags: TAGS,
        summary: 'Issue registration OTP',
        description:
          'Sends an OTP SMS to the phone. Rate-limited per phone (cooldown + daily cap). ' +
          '`devOtp` is returned only outside production.',
        body: OtpBody,
        response: { 200: OtpResponse, 429: ERROR },
      },
    },
    async (req, reply) => {
      const { phone } = req.body;

      // Per-phone cooldown: at most one code every OTP_COOLDOWN_SECONDS.
      const cooldownKey = `client:otp:cooldown:${phone}`;
      const onCooldown = await redis.get(cooldownKey).catch(() => null);
      if (onCooldown) return reply.code(429).sendError('otp_cooldown');

      // Per-phone daily cap.
      const dailyKey = `client:otp:daily:${phone}`;
      const count = await redis.incr(dailyKey).catch(() => 0);
      if (count === 1) await redis.expire(dailyKey, OTP_DAILY_TTL).catch(() => undefined);
      if (count > OTP_DAILY_LIMIT) return reply.code(429).sendError('otp_daily_limit');

      const code = await createOtp(phone, 'register');
      await redis.set(cooldownKey, '1', 'EX', OTP_COOLDOWN_SECONDS).catch(() => undefined);
      await sendOtpSms(phone, code);

      if (!isProd) req.log.info({ phone, code }, 'client register OTP issued');
      return { ok: true, ...(isProd ? {} : { devOtp: code }) };
    },
  );

  /* ── OTP verify ─────────────────────────────────────────────────────────── */

  fastify.post(
    '/otp/verify',
    {
      schema: {
        tags: TAGS,
        summary: 'Verify registration OTP',
        description: 'Verifies the OTP and returns a phone-verified registration token.',
        body: OtpVerifyBody,
        response: { 200: OtpVerifyResponse, 400: ERROR },
      },
    },
    async (req, reply) => {
      const { phone } = req.body;
      const ok = await verifyOtp(phone, req.body.code, 'register');
      if (!ok) return reply.code(400).sendError('invalid_otp');

      const regToken = app.jwt.sign({ phone, step: 'phone_verified' } satisfies RegTokenPhase1, {
        expiresIn: REG_TOKEN_TTL,
      });
      return { regToken };
    },
  );

  /* ── MyID session ───────────────────────────────────────────────────────── */

  fastify.post(
    '/myid-session',
    {
      schema: {
        tags: TAGS,
        summary: 'Start MyID session',
        description:
          'Opens a MyID liveness session for the PINFL. Returns a pinfl-verified ' +
          'registration token and the MyID session id.',
        body: MyidSessionBody,
        response: { 200: MyidSessionResponse, 400: ERROR },
      },
    },
    async (req, reply) => {
      let payload: RegTokenPhase1 | RegTokenPhase2;
      try {
        payload = app.jwt.verify<RegTokenPhase1 | RegTokenPhase2>(req.body.regToken);
      } catch {
        return reply.code(400).sendError('invalid_reg_token');
      }
      // Accept either a freshly phone-verified token or an already pinfl-verified
      // one — re-issuing a MyID session after a failed liveness scan is always
      // legitimate (the phone is already proven). 15m token expiry bounds it.
      if (payload.step !== 'phone_verified' && payload.step !== 'pinfl_verified') {
        return reply.code(400).sendError('invalid_step');
      }

      const { pinfl } = req.body;
      const myidResult = await createMyidSession(pinfl, req.ip);

      const regToken = app.jwt.sign(
        { phone: payload.phone, pinfl, step: 'pinfl_verified' } satisfies RegTokenPhase2,
        { expiresIn: REG_TOKEN_TTL },
      );
      return { regToken, sessionId: myidResult.sessionId };
    },
  );

  /* ── MyID complete ──────────────────────────────────────────────────────── */

  fastify.post(
    '/myid-complete',
    {
      schema: {
        tags: TAGS,
        summary: 'Complete registration',
        description:
          'Exchanges the MyID code and creates the account on first registration ' +
          '(recording public-offer acceptance). Returns a short-lived regToken that ' +
          'authorizes POST /client/auth/setup — no session is created here.',
        body: MyidCompleteBody,
        response: { 200: MyidCompleteResponse, 400: ERROR, 409: ERROR },
      },
    },
    async (req, reply) => {
      let phase2: RegTokenPhase2;
      try {
        phase2 = app.jwt.verify<RegTokenPhase2>(req.body.regToken);
      } catch {
        return reply.code(400).sendError('invalid_reg_token');
      }
      if (phase2.step !== 'pinfl_verified') {
        return reply.code(400).sendError('invalid_step');
      }

      const myidUser = await exchangeMyidCode(req.body.myidCode);
      if (myidUser.pinfl !== phase2.pinfl) {
        return reply.code(400).sendError('pinfl_mismatch');
      }

      // Idempotent on the MyID-verified PINFL. If the identity already has an
      // account it must belong to the same OTP-verified phone, otherwise reject.
      const existing = await findUserByPinfl(phase2.pinfl);
      let client: typeof users.$inferSelect;
      if (existing) {
        if (existing.phone !== phase2.phone) {
          return reply.code(409).sendError('phone_pinfl_mismatch');
        }
        // Existing users already accepted the terms at their original signup;
        // re-verification does not re-record acceptance.
        client = existing;
      } else {
        // New account: the submitted public_offer version must still be current.
        const offer = await findCurrentPublicOfferById(req.body.publicOfferId);
        if (!offer) return reply.code(400).sendError('public_offer_stale');

        // Create the user and record the terms acceptance atomically, so a new
        // account can never exist without its registration consent row.
        client = await db.transaction(async (tx) => {
          const created = await createUserHandler(
            {
              phone: phase2.phone,
              pinfl: myidUser.pinfl,
              firstName: myidUser.firstName,
              lastName: myidUser.lastName,
              middleName: myidUser.middleName || '',
              birthDate: myidUser.birthDate,
              nationality: myidUser.nationality,
              passportSeries: myidUser.passportSerial,
              passportNumber: myidUser.passportNumber,
              address: myidUser.address || undefined,
              regionCode: myidUser.regionCode ?? '',
              districtCode: myidUser.districtCode ?? '',
              docType: myidUser.docType || 1,
              citizenShipId: myidUser.citizenShipId,
              temporaryRegistration: myidUser.temporaryRegistration,
              permanentRegistration: myidUser.permanentRegistration,
              gender: +myidUser.gender,
              verifiedAt: new Date(),
            },
            tx,
          );
          await tx
            .insert(userPublicOfferAcceptances)
            .values({ userId: created!.id, publicOfferId: offer.id });
          return created!;
        });
      }

      // A completed OTP + MyID re-auth is the recovery path for a PIN lockout —
      // clear any accumulated failed-PIN counter for this phone.
      await redis.del(pinFailKey(phase2.phone)).catch(() => undefined);

      // Onboarding token consumed only by POST /client/auth/setup. It carries no
      // `type` field, so it can never satisfy verifyClientJwt as an access token.
      const regToken = app.jwt.sign(
        { sub: client.id.toString(), step: 'identity_verified' },
        { expiresIn: REG_TOKEN_TTL },
      );

      return { regToken, client: toClientDto(client) };
    },
  );
}
