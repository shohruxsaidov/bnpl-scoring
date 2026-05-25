import { Type } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { users } from "../../id/db/schema";
import { createUser, findUserByPinfl } from "../../auth/client/service";
import { createMyidSession, exchangeMyidCode } from "../../auth/client/myid";

function toClientDto(u: typeof users.$inferSelect) {
  return {
    pinfl: u.pinfl,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    birthDate: u.birthDate,
    gender: u.gender,
    nationality: u.nationality,
    passportSerial: u.passportSerial,
    passportNumber: u.passportNumber,
    photoUrl: u.photoUrl,
  };
}

export default async function merchantClientRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const SearchQuery = Type.Object({
    pinfl: Type.String({ minLength: 14, maxLength: 14, pattern: "^\\d{14}$" }),
  });

  const MyidSessionBody = Type.Object({
    pinfl: Type.String({ minLength: 14, maxLength: 14, pattern: "^\\d{14}$" }),
  });

  const MyidCompleteBody = Type.Object({
    pinfl: Type.String({ minLength: 14, maxLength: 14, pattern: "^\\d{14}$" }),
    phone: Type.String({ minLength: 1 }),
    myidCode: Type.String({ minLength: 1 }),
  });

  /** Search for an existing registered client by PINFL. */
  fastify.get(
    "/search",
    {
      schema: { querystring: SearchQuery },
      preHandler: app.verifyMerchantJwt,
    },
    async (request, reply) => {
      const { pinfl } = request.query;
      const user = await findUserByPinfl(db, pinfl);
      if (!user) return reply.code(404).send({ code: "client_not_found" });
      return { client: toClientDto(user) };
    },
  );

  /** Create a MyID session for a new (unregistered) client. */
  fastify.post(
    "/myid-session",
    {
      schema: { body: MyidSessionBody },
      preHandler: app.verifyMerchantJwt,
    },
    async (request, reply) => {
      const { pinfl } = request.body;

      const existing = await findUserByPinfl(db, pinfl);
      if (existing) return reply.code(409).send({ code: "client_already_registered" });

      const myidResult = await createMyidSession(pinfl, request.ip);

      return {
        sessionId: myidResult.sessionId,
        iframeUrl: myidResult.iframeUrl,
        mock: myidResult.mock,
      };
    },
  );

  /** Complete MyID verification and register (or fetch) the client. */
  fastify.post(
    "/myid-complete",
    {
      schema: { body: MyidCompleteBody },
      preHandler: app.verifyMerchantJwt,
    },
    async (request, reply) => {
      const { pinfl, phone, myidCode } = request.body;

      const myidUser = await exchangeMyidCode(myidCode, pinfl);

      if (myidUser.pinfl !== pinfl) {
        return reply.code(400).send({ code: "pinfl_mismatch" });
      }

      // Re-check: might have been registered between session creation and completion.
      const existing = await findUserByPinfl(db, pinfl);
      if (existing) return { client: toClientDto(existing), isNew: false };

      const user = await createUser(db, {
        phone,
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

      return { client: toClientDto(user), isNew: true };
    },
  );
}
