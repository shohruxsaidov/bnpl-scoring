import { Type } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance, FastifyReply } from "fastify";
import { env } from "../../../env.js";
import type { users } from "../../id/db/schema.js";
import {
  createOtp,
  createSession,
  createUser,
  findUserByPhone,
  findUserByPinfl,
  revokeSession,
  verifyOtp,
  verifySession,
} from "./service.js";
import { createMyidSession, exchangeMyidCode } from "./myid";

/** Normalize a 9-digit national phone number to E.164 (+998XXXXXXXXX). */
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  // Tolerate inputs that already include the country code.
  const national = digits.startsWith("998") ? digits.slice(3) : digits;
  return `+998${national}`;
}

const ACCESS_MAX_AGE = 15 * 60; // seconds
const SESSION_MAX_AGE = env.SESSION_EXPIRES_DAYS * 24 * 60 * 60; // seconds

const isProd = env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
};

/** Reg-token shape carried between registration steps. */
interface RegTokenPhase1 {
  phone: string;
  step: "phone_verified";
}
interface RegTokenPhase2 {
  phone: string;
  pinfl: string;
  myidSessionId: string;
  step: "pinfl_verified";
}

function setAuthCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  userId: bigint,
  sessionToken: string,
): void {
  const accessToken = app.jwt.sign(
    { sub: userId.toString(), type: "client" },
    { expiresIn: ACCESS_MAX_AGE },
  );

  reply.setCookie("access_token", accessToken, {
    ...baseCookie,
    maxAge: ACCESS_MAX_AGE,
  });
  reply.setCookie("session_id", sessionToken, {
    ...baseCookie,
    maxAge: SESSION_MAX_AGE,
  });
}

function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie("access_token", { ...baseCookie });
  reply.clearCookie("session_id", { ...baseCookie });
}

function toUserDto(u: typeof users.$inferSelect) {
  return {
    id: u.id.toString(),
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    birthDate: u.birthDate,
    gender: u.gender,
    nationality: u.nationality,
    passportSerial: u.passportSerial,
    passportNumber: u.passportNumber,
    photoUrl: u.photoUrl,
  };
}

export default async function clientAuthRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const PhoneBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
  });
  const OtpBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
    code: Type.String({ minLength: 1 }),
  });
  const RegisterOtpBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
    code: Type.String({ minLength: 1 }),
  });
  const PinflBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    pinfl: Type.String({ minLength: 1 }),
  });
  const CompleteBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    myidCode: Type.String({ minLength: 1 }),
  });

  /* ── Registration ───────────────────────────────────────────────────────── */

  fastify.post(
    "/register/phone",
    { schema: { body: PhoneBody } },
    async (request, reply) => {
      const phone = normalizePhone(request.body.phone);

      const existing = await findUserByPhone(db, phone);
      if (existing) return reply.code(409).send({ code: "phone_taken" });

      const code = await createOtp(db, phone, "register");
      if (!isProd) request.log.info({ phone, code }, "register OTP issued");

      return { ok: true, ...(isProd ? {} : { devOtp: code }) };
    },
  );

  fastify.post(
    "/register/otp",
    { schema: { body: RegisterOtpBody } },
    async (request, reply) => {
      const phone = normalizePhone(request.body.phone);

      const ok = await verifyOtp(db, phone, request.body.code, "register");
      if (!ok) return reply.code(400).send({ code: "invalid_otp" });

      const regToken = app.jwt.sign(
        { phone, step: "phone_verified" } satisfies RegTokenPhase1,
        { expiresIn: "15m" },
      );

      return { regToken };
    },
  );

  fastify.post(
    "/register/pinfl",
    { schema: { body: PinflBody } },
    async (request, reply) => {
      let payload: RegTokenPhase1;
      try {
        payload = app.jwt.verify<RegTokenPhase1>(request.body.regToken);
      } catch {
        return reply.code(400).send({ code: "invalid_reg_token" });
      }
      if (payload.step !== "phone_verified") {
        return reply.code(400).send({ code: "invalid_step" });
      }

      const pinfl = request.body.pinfl.trim();
      if (pinfl.length !== 14 || !/^\d{14}$/.test(pinfl)) {
        return reply.code(400).send({ code: "invalid_pinfl" });
      }

      const existing = await findUserByPinfl(db, pinfl);
      if (existing) return reply.code(409).send({ code: "pinfl_taken" });

      const myidResult = await createMyidSession(pinfl, request.ip).catch((err) => {
        request.log.error(
          { err },
          "MyID session creation failed, falling back to mock",
        );
        return null;
      });
      if (myidResult === null) {
        // In case of MyID integration failure throw an error in production, but allow fallback to mock data in non-production environments for testing purposes.
        return reply.code(500).send({ code: "myid_integration_failed" });
      }

      const regToken = app.jwt.sign(
        {
          phone: payload.phone,
          pinfl,
          myidSessionId: myidResult.sessionId,
          step: "pinfl_verified",
        } satisfies RegTokenPhase2,
        { expiresIn: "15m" },
      );

      return { regToken, mock: false, iframeUrl: myidResult.iframeUrl };
    },
  );

  fastify.post(
    "/register/complete",
    { schema: { body: CompleteBody } },
    async (request, reply) => {
      let payload: RegTokenPhase2;
      try {
        payload = app.jwt.verify<RegTokenPhase2>(request.body.regToken);
      } catch {
        return reply.code(400).send({ code: "invalid_reg_token" });
      }
      if (payload.step !== "pinfl_verified") {
        return reply.code(400).send({ code: "invalid_step" });
      }

      const myidUser = await exchangeMyidCode(
        request.body.myidCode,
        payload.pinfl,
      );

      if (myidUser.pinfl !== payload.pinfl) {
        return reply.code(400).send({ code: "pinfl_mismatch" });
      }

      const existing = await findUserByPinfl(db, payload.pinfl);
      if (existing) return reply.code(409).send({ code: "pinfl_taken" });

      const user = await createUser(db, {
        phone: payload.phone,
        pinfl: myidUser.pinfl,
        firstName: myidUser.firstName,
        lastName: myidUser.lastName,
        birthDate: myidUser.birthDate,
        gender: myidUser.gender,
        nationality: myidUser.nationality,
        passportSerial: myidUser.passportSerial,
        passportNumber: myidUser.passportNumber,
        photoUrl: myidUser.photoUrl,
      });

      const { sessionToken } = await createSession(db, user.id);
      setAuthCookies(app, reply, user.id, sessionToken);

      return { user: toUserDto(user) };
    },
  );

  /* ── Login ──────────────────────────────────────────────────────────────── */

  fastify.post(
    "/login/phone",
    { schema: { body: PhoneBody } },
    async (request, reply) => {
      const phone = normalizePhone(request.body.phone);

      const user = await findUserByPhone(db, phone);
      if (!user) return reply.code(404).send({ code: "no_account" });

      const code = await createOtp(db, phone, "login");
      if (!isProd) request.log.info({ phone, code }, "login OTP issued");

      return { ok: true, ...(isProd ? {} : { devOtp: code }) };
    },
  );

  fastify.post(
    "/login/otp",
    { schema: { body: OtpBody } },
    async (request, reply) => {
      const phone = normalizePhone(request.body.phone);

      const ok = await verifyOtp(db, phone, request.body.code, "login");
      if (!ok) return reply.code(400).send({ code: "invalid_otp" });

      const user = await findUserByPhone(db, phone);
      if (!user) return reply.code(404).send({ code: "no_account" });

      const { sessionToken } = await createSession(db, user.id);
      setAuthCookies(app, reply, user.id, sessionToken);

      return { user: toUserDto(user) };
    },
  );

  /* ── Session lifecycle ──────────────────────────────────────────────────── */

  fastify.post("/refresh", async (request, reply) => {
    const sessionToken = request.cookies.session_id;
    if (!sessionToken) return reply.code(401).send({ code: "unauthorized" });

    const result = await verifySession(db, sessionToken);
    if (!result) {
      clearAuthCookies(reply);
      return reply.code(401).send({ code: "unauthorized" });
    }

    const accessToken = app.jwt.sign(
      { sub: result.user.id.toString(), type: "client" },
      { expiresIn: ACCESS_MAX_AGE },
    );
    reply.setCookie("access_token", accessToken, {
      ...baseCookie,
      maxAge: ACCESS_MAX_AGE,
    });

    return { ok: true };
  });

  fastify.post("/logout", async (request, reply) => {
    const sessionToken = request.cookies.session_id;
    if (sessionToken) await revokeSession(db, sessionToken);

    clearAuthCookies(reply);
    return { ok: true };
  });
}
