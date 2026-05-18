/**
 * POST /api/auth/login — Agents + Merchant Admins.
 * Single-role session: if the employee has >1 role, return the role list
 * (no token) so the client shows a picker; if exactly one, issue the JWT.
 */

import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import type { LoginResult, RoleName } from "@scoring/types";

const LoginBody = Type.Object({
  login: Type.String({ minLength: 1 }),
  password: Type.String({ minLength: 1 }),
  role: Type.Optional(Type.String()),
});

const LoginResponse = Type.Object({
  employee: Type.Object({
    id: Type.String(),
    fullName: Type.String(),
    phone: Type.String(),
  }),
  roles: Type.Array(Type.String()),
  token: Type.Union([Type.String(), Type.Null()]),
});

export async function agentAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/auth/login",
    { schema: { body: LoginBody, response: { 200: LoginResponse } } },
    async (req): Promise<LoginResult> => {
      const { role } = req.body as { role?: RoleName };

      // Stubbed credential check — replace with employees.service verify.
      const employee = {
        id: "00000000-0000-0000-0000-000000000001",
        fullName: "Demo Agent",
        phone: "+998900000000",
      };
      const tenantId = "00000000-0000-0000-0000-0000000000aa";
      const roles: RoleName[] = ["agent", "merchant_admin"];

      if (roles.length > 1 && !role) {
        return { employee, roles, token: null };
      }

      const activeRole = role ?? roles[0]!;
      const token = app.jwt.sign({
        userId: employee.id,
        tenantId,
        role: activeRole,
      });
      return { employee, roles, token };
    },
  );
}
