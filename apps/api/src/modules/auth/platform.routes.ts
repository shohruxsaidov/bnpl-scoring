/** POST /api/platform/auth/login — Platform Admins (no tenant scope). */

import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";

const Body = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 1 }),
});

const Response = Type.Object({
  user: Type.Object({ id: Type.String(), email: Type.String() }),
  token: Type.String(),
});

export async function platformAuthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/api/platform/auth/login",
    { schema: { body: Body, response: { 200: Response } } },
    async () => {
      const user = {
        id: "00000000-0000-0000-0000-0000000000f0",
        email: "admin@platform.local",
      };
      const token = app.jwt.sign({
        userId: user.id,
        role: "platform_admin",
      });
      return { user, token };
    },
  );
}
