import { Type } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { clients } from "../../id/db/schema.js";
import {
  createClient,
  findClientByPinflAndMerchant,
  searchClients,
} from "./service.js";
import {
  createOtp,
  verifyOtp,
} from "../../auth/client/service.js";
import { createMyidSession, exchangeMyidCode } from "../../auth/client/myid.js";

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const national = digits.startsWith("998") ? digits.slice(3) : digits;
  return `+998${national}`;
}

function toClientDto(c: typeof clients.$inferSelect) {
  return {
    id: c.id.toString(),
    pinfl: c.pinfl,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    birthDate: c.birthDate,
    gender: c.gender,
    nationality: c.nationality,
    passportSerial: c.passportSerial,
    passportNumber: c.passportNumber,
    photoUrl: c.photoUrl,
  };
}

interface RegTokenPhase1 {
  phone: string;
  step: "phone_verified";
}

interface RegTokenPhase2 {
  phone: string;
  pinfl: string;
  myidSessionId: string;
  merchantId: string;
  branchId: string;
  step: "pinfl_verified";
}

export default async function merchantClientRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const SearchQuery = Type.Object({
    q: Type.String({ minLength: 1, maxLength: 100 }),
  });
  const OtpBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
  });
  const OtpVerifyBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
    code: Type.String({ minLength: 1 }),
  });
  const MyidSessionBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    pinfl: Type.String({ minLength: 14, maxLength: 14, pattern: "^\\d{14}$" }),
  });
  const MyidCompleteBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    myidCode: Type.String({ minLength: 1 }),
  });

  /* ── Search ─────────────────────────────────────────────────────────────── */

  fastify.get(
    "/search",
    { schema: { querystring: SearchQuery }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const payload = request.user as { sub: string; merchantId: string };
      const { q } = request.query;
      const results = await searchClients(db, q, BigInt(payload.merchantId));
      return { clients: results.map(toClientDto) };
    },
  );

  /* ── OTP ────────────────────────────────────────────────────────────────── */

  fastify.post(
    "/otp",
    { schema: { body: OtpBody }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const phone = normalizePhone(request.body.phone);
      const isProd = app.hasDecorator("isProd")
        ? (app as any).isProd
        : process.env["NODE_ENV"] === "production";

      const code = await createOtp(db, phone, "client_registration");
      if (!isProd) request.log.info({ phone, code }, "client_registration OTP issued");

      return { ok: true, ...(isProd ? {} : { devOtp: code }) };
    },
  );

  fastify.post(
    "/otp/verify",
    { schema: { body: OtpVerifyBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const phone = normalizePhone(request.body.phone);
      const ok = await verifyOtp(db, phone, request.body.code, "client_registration");
      if (!ok) return reply.code(400).send({ code: "invalid_otp" });

      const regToken = app.jwt.sign(
        { phone, step: "phone_verified" } satisfies RegTokenPhase1,
        { expiresIn: "15m" },
      );
      return { regToken };
    },
  );

  /* ── MyID session ───────────────────────────────────────────────────────── */

  fastify.post(
    "/myid-session",
    { schema: { body: MyidSessionBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      let phase1: RegTokenPhase1;
      try {
        phase1 = app.jwt.verify<RegTokenPhase1>(request.body.regToken);
      } catch {
        return reply.code(400).send({ code: "invalid_reg_token" });
      }
      if (phase1.step !== "phone_verified") {
        return reply.code(400).send({ code: "invalid_step" });
      }

      const payload = request.user as {
        merchantId: string;
        branchId: string;
      };
      const { pinfl } = request.body;

      const existing = await findClientByPinflAndMerchant(
        db,
        pinfl,
        BigInt(payload.merchantId),
      );
      if (existing) return reply.code(409).send({ code: "client_already_registered" });

      const myidResult = await createMyidSession(db, pinfl, request.ip);

      const regToken = app.jwt.sign(
        {
          phone: phase1.phone,
          pinfl,
          myidSessionId: myidResult.sessionId,
          merchantId: payload.merchantId,
          branchId: payload.branchId,
          step: "pinfl_verified",
        } satisfies RegTokenPhase2,
        { expiresIn: "15m" },
      );

      return { regToken, iframeUrl: myidResult.iframeUrl, mock: myidResult.mock };
    },
  );

  /* ── MyID complete ──────────────────────────────────────────────────────── */

  fastify.post(
    "/myid-complete",
    { schema: { body: MyidCompleteBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      let phase2: RegTokenPhase2;
      try {
        phase2 = app.jwt.verify<RegTokenPhase2>(request.body.regToken);
      } catch {
        return reply.code(400).send({ code: "invalid_reg_token" });
      }
      if (phase2.step !== "pinfl_verified") {
        return reply.code(400).send({ code: "invalid_step" });
      }

      const myidUser = await exchangeMyidCode(db, request.body.myidCode);
      if (myidUser.pinfl !== phase2.pinfl) {
        return reply.code(400).send({ code: "pinfl_mismatch" });
      }

      const merchantId = BigInt(phase2.merchantId);
      const branchId = BigInt(phase2.branchId);

      const existing = await findClientByPinflAndMerchant(db, phase2.pinfl, merchantId);
      if (existing) return { client: toClientDto(existing), isNew: false };

      const client = await createClient(db, {
        phone: phase2.phone,
        pinfl: myidUser.pinfl,
        firstName: myidUser.firstName,
        lastName: myidUser.lastName,
        birthDate: myidUser.birthDate,
        gender: myidUser.gender,
        nationality: myidUser.nationality,
        passportSerial: myidUser.passportSerial,
        passportNumber: myidUser.passportNumber,
        photoUrl: myidUser.photoUrl,
        merchantId,
        branchId,
      });

      return { client: toClientDto(client), isNew: true };
    },
  );
}
