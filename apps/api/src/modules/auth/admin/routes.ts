import { Type } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance, FastifyReply } from "fastify";
import { env } from "../../../env.js";
import {
  createAdminSession,
  createAdminUser,
  findAdminByEmail,
  revokeAdminSession,
  verifyAdminSession,
  verifyPassword,
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

const ACCESS_COOKIE = "admin_access_token";
const SESSION_COOKIE = "admin_session_id";

function buildAccessToken(app: FastifyInstance, adminId: bigint): string {
  return app.jwt.sign(
    { sub: adminId.toString(), type: "admin" },
    { expiresIn: ACCESS_MAX_AGE },
  );
}

function setAuthCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  adminId: bigint,
  sessionToken: string,
): void {
  reply.setCookie(ACCESS_COOKIE, buildAccessToken(app, adminId), {
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

function serializeAdmin(admin: { id: bigint; email: string; fullName: string }) {
  return {
    id: admin.id.toString(),
    email: admin.email,
    fullName: admin.fullName,
  };
}

export default async function adminAuthRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const LoginBody = Type.Object({
    email: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 1 }),
  });

  const CreateAdminBody = Type.Object({
    email: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 8 }),
    fullName: Type.String({ minLength: 1 }),
  });

  /* ── Login ──────────────────────────────────────────────────────────────── */

  fastify.post(
    "/login",
    { schema: { body: LoginBody } },
    async (request, reply) => {
      const admin = await findAdminByEmail(db, request.body.email);

      if (!admin || !admin.active) {
        return reply.code(401).send({ code: "invalid_credentials" });
      }

      const ok = await verifyPassword(admin.passwordHash, request.body.password);
      if (!ok) {
        return reply.code(401).send({ code: "invalid_credentials" });
      }

      const { sessionToken } = await createAdminSession(db, admin.id);
      setAuthCookies(app, reply, admin.id, sessionToken);

      return { user: serializeAdmin(admin) };
    },
  );

  /* ── Session lifecycle ──────────────────────────────────────────────────── */

  fastify.post("/refresh", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (!sessionToken) return reply.code(401).send({ code: "unauthorized" });

    const result = await verifyAdminSession(db, sessionToken);
    if (!result) {
      clearAuthCookies(reply);
      return reply.code(401).send({ code: "unauthorized" });
    }

    reply.setCookie(ACCESS_COOKIE, buildAccessToken(app, result.admin.id), {
      ...baseCookie,
      maxAge: ACCESS_MAX_AGE,
    });

    return { ok: true };
  });

  fastify.post("/logout", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (sessionToken) await revokeAdminSession(db, sessionToken);

    clearAuthCookies(reply);
    return { ok: true };
  });

  /* ── Admin management (guarded) ─────────────────────────────────────────── */

  fastify.post(
    "/users",
    {
      schema: { body: CreateAdminBody },
      preHandler: app.verifyAdminJwt,
    },
    async (request, reply) => {
      const existing = await findAdminByEmail(db, request.body.email);
      if (existing) return reply.code(409).send({ code: "email_taken" });

      const createdById = BigInt((request.user as { sub: string }).sub);
      const admin = await createAdminUser(db, {
        email: request.body.email,
        password: request.body.password,
        fullName: request.body.fullName,
        createdById,
      });

      return { user: serializeAdmin(admin) };
    },
  );
}
