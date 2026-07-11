import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { redis } from '@redis';
import { env } from '@env';
import { db } from '@db';
import { users } from '@db/schema';
import { userPublicOfferAcceptances } from '@db/user-public-offer-acceptances';
import { getDownloadUrl } from '../../../lib/file-storage';
import {
  createOtp,
  verifyOtp,
  findUserByPinfl,
  findUserByPhone,
} from '../../auth/client/service/service.handler';
import { createUserHandler } from '../../id/users';
import { sendOtpSms } from '../../../lib/sms';
import { getCurrentPublicOffer, findCurrentPublicOfferById } from './public-offers';
import { pinFailKey } from '../auth/index';
import {
  createMobileMyidSession,
  exchangeMobileMyidCode,
} from '../../integrations/myid/myid-mobile-new-flow';
import { v4 as uuidv4 } from 'uuid';
const ERROR = { $ref: 'ErrorResponse#' };

const UZBEKISTAN_CITIZENSHIP_ID = '182';

const OTP_COOLDOWN_SECONDS = 60;
//TODO need to change to 10
const OTP_DAILY_LIMIT = 100;
const OTP_DAILY_TTL = 24 * 60 * 60;
const REG_TOKEN_TTL = '15m';

interface RegTokenPhase1 {
  phone: string;
  step: 'phone_verified';
}

interface RegTokenPhase2 {
  phone: string;
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
    forgotPin: Type.Optional(Type.Boolean({ default: false, examples: [false] })),
  });
  const OtpVerifyBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12, examples: ['998991234567'] }),
    code: Type.String({ minLength: 4, maxLength: 4, examples: ['1234'] }),
  });
  const MyidSessionBody = Type.Object({
    regToken: Type.String({ minLength: 1, examples: ['ey.....'] }),
    pinfl: Type.Optional(
      Type.String({
        minLength: 14,
        maxLength: 14,
        pattern: '^\\d{14}$',
        examples: ['12345678901234'],
      }),
    ),
    passData: Type.Optional(Type.String({ minLength: 1, maxLength: 9, examples: ['AD1234567'] })),
    birthDate: Type.Optional(
      Type.String({ minLength: 10, maxLength: 10, examples: ['1990-05-14'] }),
    ),
  });
  const MyidCompleteBody = Type.Object({
    regToken: Type.String({ minLength: 1, examples: ['ey..'] }),
    myidCode: Type.String({ minLength: 1, examples: ['jfkdjfkd'] }),
    // Id of the public_offers version the client accepted (the row returned by
    // GET /public-offer). Required for new accounts; must be the current version.
    publicOfferId: Type.Integer({ minimum: 1, examples: [1] }),
  });

  /* ── Response schemas (examples power the Swagger UI sample bodies) ──────── */

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

  const PublicOfferQuery = Type.Object({
    lang: Type.Optional(
      Type.Union([Type.Literal('uz'), Type.Literal('ru')], { default: 'uz', examples: ['uz'] }),
    ),
  });

  const PublicOfferResponse = Type.Object(
    {
      // Echoed back as `publicOfferId` at POST /myid-complete.
      id: Type.Integer(),
      version: Type.Integer(),
      // Presigned GET URL for the language PDF; the client fetches it directly.
      url: Type.String(),
    },
    { examples: [{ id: 1, version: 1, url: 'https://minio.example.com/…/public-offers/uuid?…' }] },
  );

  // Returns the current offer's id/version plus a presigned URL to its PDF for
  // the requested language. `id` is sent back later as `publicOfferId` at
  // /myid-complete.
  fastify.get(
    '/public-offer',
    {
      schema: {
        tags: TAGS,
        summary: 'Current public offer',
        querystring: PublicOfferQuery,
        response: { 200: PublicOfferResponse, 404: ERROR },
      },
    },
    async (req, reply) => {
      const offer = await getCurrentPublicOffer();
      if (!offer) return reply.code(404).sendError('public_offer_not_found');

      const lang = req.query.lang ?? 'uz';
      const fileId = lang === 'ru' ? offer.fileRuId : offer.fileUzId;
      const url = await getDownloadUrl(db, fileId);

      return { id: offer.id, version: offer.version, url };
    },
  );

  /* ── OTP issue ──────────────────────────────────────────────────────────── */

  fastify.post(
    '/otp',
    {
      config: {
        rateLimit: {
          max: 2,
          timeWindow: 60 * 1000, // 10 requests per minute per IP
        },
      },
      schema: {
        tags: TAGS,
        summary: 'Issue registration OTP',
        body: OtpBody,
        response: { 200: OtpResponse, 429: ERROR, 404: ERROR },
      },
    },
    async (req, reply) => {
      const { phone, forgotPin } = req.body;
      if (forgotPin) {
        const existing = await findUserByPhone(phone);
        if (!existing) return reply.code(404).sendError('user_not_found');
      }

      // Per-phone cooldown: at most one code every OTP_COOLDOWN_SECONDS.
      const cooldownKey = `client:otp:cooldown:${phone}`;
      const onCooldown = await redis.get(cooldownKey).catch(() => null);

      if (onCooldown) {
        const ttl = await redis.ttl(cooldownKey).catch(() => OTP_COOLDOWN_SECONDS);
        return reply.code(429).sendError('otp_cooldown', {
          seconds: ttl > 0 ? ttl : OTP_COOLDOWN_SECONDS,
        });
      }

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
      config: {
        rateLimit: {
          max: 2,
          timeWindow: 60 * 1000, // 10 requests per minute per IP
        },
      },
      schema: {
        tags: TAGS,
        summary: 'Verify registration OTP',
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

      const { pinfl, birthDate, passData } = req.body;
      let sessionId: string;
      if (pinfl) {
        const myidResult = await createMobileMyidSession(pinfl);
        sessionId = myidResult.sessionId;
      } else if (birthDate && passData) {
        const myidResult = await createMobileMyidSession({ passData, birthDate });
        sessionId = myidResult.sessionId;
      } else {
        return reply.code(400).sendError('missing_myid_credentials');
      }

      const regToken = app.jwt.sign(
        { phone: payload.phone, step: 'pinfl_verified' } satisfies RegTokenPhase2,
        { expiresIn: REG_TOKEN_TTL },
      );
      return { regToken, sessionId: uuidv4() };
    },
  );

  /* ── MyID complete ──────────────────────────────────────────────────────── */

  fastify.post(
    '/myid-complete',
    {
      schema: {
        tags: TAGS,
        summary: 'Complete registration',
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

      const myidUser = await exchangeMobileMyidCode(req.body.myidCode);

      // Idempotent on the MyID-verified PINFL. If the identity already has an
      // account it must belong to the same OTP-verified phone, otherwise reject.
      const existing = await findUserByPinfl(myidUser.pinfl);
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
        // const offer = await findCurrentPublicOfferById(req.body.publicOfferId);
        // if (!offer) return reply.code(400).sendError('public_offer_stale');

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
              citizenShipId: myidUser.citizenShipId || UZBEKISTAN_CITIZENSHIP_ID,
              temporaryRegistration: myidUser.temporaryRegistration || null,
              permanentRegistration: myidUser.permanentRegistration || null,
              gender: +myidUser.gender,
              verifiedAt: new Date(),
            },
            tx,
          );
          await tx
            .insert(userPublicOfferAcceptances)
            .values({ userId: created!.id, publicOfferId: req.body.publicOfferId });
          return created!;
        });
      }

      // A completed OTP + MyID re-auth is the recovery path for a PIN lockout —
      // clear any accumulated failed-PIN counter for this phone.
      await redis.del(pinFailKey(phase2.phone)).catch(() => undefined);

      // Onboarding token consumed only by POST /client/auth/setup. It carries no
      // `type` field, so it can never satisfy verifyClientJwt as an access token.
      // `deviceId` pins it to the device that finished MyID: /setup sets the
      // password, trusts the caller's device and (optionally) enrols a biometric
      // key, so a leaked bearer token would otherwise buy a permanent credential.
      const regToken = app.jwt.sign(
        { sub: client.id.toString(), step: 'identity_verified', deviceId: req.deviceId },
        { expiresIn: REG_TOKEN_TTL },
      );

      return { regToken, client: toClientDto(client) };
    },
  );
}
