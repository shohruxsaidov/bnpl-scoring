import { Type } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance, FastifyReply } from "fastify";
import { env } from "../../../env.js";
import {
  createMerchantSession,
  findMerchantUserByEmail,
  findMerchantUserById,
  revokeMerchantSession,
  verifyMerchantSession,
  verifyPassword,
  type MerchantRole,
} from "./service.js";

const ACCESS_MAX_AGE = 15 * 60;
const SESSION_MAX_AGE = env.SESSION_EXPIRES_DAYS * 24 * 60 * 60;

const isProd = env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
};

// Prefixed to avoid collisions with client portal cookies.
const ACCESS_COOKIE = "merchant_access_token";
const SESSION_COOKIE = "merchant_session_id";

interface PickerToken {
  employeeId: string;
  roles: MerchantRole[];
  merchantId: string;
  branchId: string;
  step: "role_selection";
}

function buildAccessToken(
  app: FastifyInstance,
  employee: { id: bigint; merchantId: bigint; branchId: bigint },
  role: string,
): string {
  return app.jwt.sign(
    {
      sub: employee.id.toString(),
      merchantId: employee.merchantId.toString(),
      branchId: employee.branchId.toString(),
      role,
      type: "merchant",
    },
    { expiresIn: ACCESS_MAX_AGE },
  );
}

function setAuthCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  employee: { id: bigint; merchantId: bigint; branchId: bigint },
  role: string,
  sessionToken: string,
): void {
  reply.setCookie(ACCESS_COOKIE, buildAccessToken(app, employee, role), {
    ...baseCookie,
    maxAge: ACCESS_MAX_AGE,
  });
  reply.setCookie(SESSION_COOKIE, sessionToken, {
    ...baseCookie,
    maxAge: SESSION_MAX_AGE,
  });
}

function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie(ACCESS_COOKIE, { ...baseCookie });
  reply.clearCookie(SESSION_COOKIE, { ...baseCookie });
}

function serializeEmployee(
  employee: {
    id: bigint;
    fullName: string;
    email: string;
    merchantId: bigint;
    branchId: bigint;
  },
  role: string,
) {
  return {
    id: employee.id.toString(),
    fullName: employee.fullName,
    email: employee.email,
    role,
    merchantId: employee.merchantId.toString(),
    branchId: employee.branchId.toString(),
  };
}

export default async function merchantAuthRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const LoginBody = Type.Object({
    email: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 1 }),
  });

  const SelectRoleBody = Type.Object({
    pickerToken: Type.String({ minLength: 1 }),
    role: Type.String({ minLength: 1 }),
  });

  /* ── Login ──────────────────────────────────────────────────────────────── */

  fastify.post(
    "/login",
    { schema: { body: LoginBody } },
    async (request, reply) => {
      const employee = await findMerchantUserByEmail(db, request.body.email);

      if (!employee || !employee.active) {
        return reply.code(401).send({ code: "invalid_credentials" });
      }

      const ok = await verifyPassword(employee.passwordHash, request.body.password);
      if (!ok) {
        return reply.code(401).send({ code: "invalid_credentials" });
      }

      const roles = employee.roles as MerchantRole[];

      if (roles.length === 1) {
        const { sessionToken } = await createMerchantSession(
          db,
          employee.id,
          roles[0]!,
        );
        setAuthCookies(app, reply, employee, roles[0]!, sessionToken);
        return { user: serializeEmployee(employee, roles[0]!) };
      }

      // Multiple roles — return picker token instead of issuing a session.
      const pickerToken = app.jwt.sign(
        {
          employeeId: employee.id.toString(),
          roles,
          merchantId: employee.merchantId.toString(),
          branchId: employee.branchId.toString(),
          step: "role_selection",
        } satisfies PickerToken,
        { expiresIn: "10m" },
      );

      return {
        requiresRolePicker: true,
        roles,
        pickerToken,
        user: {
          id: employee.id.toString(),
          fullName: employee.fullName,
          email: employee.email,
        },
      };
    },
  );

  /* ── Role picker ────────────────────────────────────────────────────────── */

  fastify.post(
    "/select-role",
    { schema: { body: SelectRoleBody } },
    async (request, reply) => {
      let payload: PickerToken;
      try {
        payload = app.jwt.verify<PickerToken>(request.body.pickerToken);
      } catch {
        return reply.code(400).send({ code: "invalid_picker_token" });
      }

      if (payload.step !== "role_selection") {
        return reply.code(400).send({ code: "invalid_step" });
      }

      const role = request.body.role as MerchantRole;
      if (!payload.roles.includes(role)) {
        return reply.code(400).send({ code: "role_not_allowed" });
      }

      const employee = await findMerchantUserById(db, BigInt(payload.employeeId));
      if (!employee || !employee.active) {
        return reply.code(401).send({ code: "invalid_credentials" });
      }

      const { sessionToken } = await createMerchantSession(db, employee.id, role);
      setAuthCookies(app, reply, employee, role, sessionToken);

      return { user: serializeEmployee(employee, role) };
    },
  );

  /* ── Session lifecycle ──────────────────────────────────────────────────── */

  fastify.post("/refresh", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (!sessionToken) return reply.code(401).send({ code: "unauthorized" });

    const result = await verifyMerchantSession(db, sessionToken);
    if (!result) {
      clearAuthCookies(reply);
      return reply.code(401).send({ code: "unauthorized" });
    }

    reply.setCookie(
      ACCESS_COOKIE,
      buildAccessToken(app, result.employee, result.session.selectedRole),
      { ...baseCookie, maxAge: ACCESS_MAX_AGE },
    );

    return { ok: true };
  });

  fastify.post("/logout", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (sessionToken) await revokeMerchantSession(db, sessionToken);

    clearAuthCookies(reply);
    return { ok: true };
  });
}
