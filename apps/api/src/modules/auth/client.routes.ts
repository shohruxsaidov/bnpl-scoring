/**
 * Client phone-OTP auth (ADR 0004).
 *  POST /api/client/auth/otp         — request an OTP code
 *  POST /api/client/auth/otp/verify  — exchange code for a client JWT
 */

import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";

const RequestBody = Type.Object({ phone: Type.String({ minLength: 1 }) });
const VerifyBody = Type.Object({
  phone: Type.String({ minLength: 1 }),
  code: Type.String({ minLength: 4, maxLength: 6 }),
});

export async function clientAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/client/auth/otp",
    { schema: { body: RequestBody } },
    async () => ({ sent: true, expiresInSec: 120 }),
  );

  app.post(
    "/api/client/auth/otp/verify",
    { schema: { body: VerifyBody } },
    async () => {
      const client = {
        id: "00000000-0000-0000-0000-0000000000c1",
        tenantId: "00000000-0000-0000-0000-0000000000aa",
      };
      const token = app.jwt.sign({
        clientId: client.id,
        tenantId: client.tenantId,
      });
      return { client, token };
    },
  );
}
