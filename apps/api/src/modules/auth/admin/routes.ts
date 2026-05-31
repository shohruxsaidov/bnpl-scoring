import { Type } from "@sinclair/typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance, FastifyReply } from "fastify";
import { env } from "../../../env";
import {
  changeAdminPassword,
  countActiveSuperadmins,
  createAdminSession,
  createAdminUser,
  findAdminByEmail,
  findAdminById,
  listAdminUsers,
  revokeAdminSession,
  setAdminRole,
  verifyAdminSession,
  verifyPassword,
} from "./service";
import type { Db } from "../../../db/index";
import { findRoleById, listRoleFeatures, effectiveFeatures } from "../../../rbac/service";

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

function buildAccessToken(app: FastifyInstance, adminId: bigint, roleId: bigint | null): string {
  return app.jwt.sign(
    { sub: adminId.toString(), type: "admin", roleId: roleId ? roleId.toString() : null },
    { expiresIn: ACCESS_MAX_AGE },
  );
}

function setAuthCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  adminId: bigint,
  roleId: bigint | null,
  sessionToken: string,
): void {
  reply.setCookie(ACCESS_COOKIE, buildAccessToken(app, adminId, roleId), {
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

type AdminRow = { id: bigint; email: string; fullName: string; roleId: bigint | null; mustChangePassword: boolean };

// Serializes an admin together with the Feature set its Role grants, so the
// frontend can drive UI from `permissions`.
async function serializeAdmin(db: Db, admin: AdminRow) {
  let isSuperadmin = false;
  let roleKey: string | null = null;
  let roleName: string | null = null;
  let features: string[] = [];

  if (admin.roleId) {
    const role = await findRoleById(db, admin.roleId);
    if (role) {
      isSuperadmin = role.isSuperadmin;
      roleKey = role.key;
      roleName = role.name;
      features = await listRoleFeatures(db, admin.roleId);
    }
  }

  return {
    id: admin.id.toString(),
    email: admin.email,
    fullName: admin.fullName,
    roleId: admin.roleId ? admin.roleId.toString() : null,
    roleKey,
    roleName,
    isSuperadmin,
    mustChangePassword: admin.mustChangePassword,
    permissions: effectiveFeatures("admin", { isSuperadmin, features }),
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
    roleId: Type.String({ minLength: 1 }),
  });

  const SetRoleBody = Type.Object({ roleId: Type.String({ minLength: 1 }) });
  const IdParams = Type.Object({ id: Type.String() });

  // True when the requesting admin holds a Superadmin role.
  async function requesterIsSuperadmin(roleId: string | null): Promise<boolean> {
    if (!roleId) return false;
    const resolved = await app.resolveRole(BigInt(roleId));
    return resolved?.isSuperadmin ?? false;
  }

  /* ── Login ──────────────────────────────────────────────────────────────── */

  fastify.post("/login", { schema: { body: LoginBody } }, async (request, reply) => {
    const admin = await findAdminByEmail(db, request.body.email);

    if (!admin || !admin.active) {
      return reply.code(401).send({ code: "invalid_credentials" });
    }

    const ok = await verifyPassword(admin.passwordHash, request.body.password);
    if (!ok) {
      return reply.code(401).send({ code: "invalid_credentials" });
    }

    const { sessionToken } = await createAdminSession(db, admin.id);
    setAuthCookies(app, reply, admin.id, admin.roleId, sessionToken);

    return { user: await serializeAdmin(db, admin) };
  });

  /* ── Session lifecycle ──────────────────────────────────────────────────── */

  fastify.get("/me", { preHandler: app.verifyAdminJwt }, async (request, reply) => {
    const payload = request.user as { sub: string; type: "admin" };
    const admin = await findAdminById(db, BigInt(payload.sub));
    if (!admin || !admin.active) {
      return reply.code(401).send({ code: "unauthorized" });
    }
    return { user: await serializeAdmin(db, admin) };
  });

  fastify.post("/refresh", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (!sessionToken) return reply.code(401).send({ code: "unauthorized" });

    const result = await verifyAdminSession(db, sessionToken);
    if (!result) {
      clearAuthCookies(reply);
      return reply.code(401).send({ code: "unauthorized" });
    }

    reply.setCookie(ACCESS_COOKIE, buildAccessToken(app, result.admin.id, result.admin.roleId), {
      ...baseCookie,
      maxAge: ACCESS_MAX_AGE,
    });

    return { ok: true };
  });

  /* ── Change password ────────────────────────────────────────────────────── */

  const ChangePasswordBody = Type.Object({
    currentPassword: Type.String({ minLength: 1 }),
    newPassword: Type.String({ minLength: 8 }),
  });

  fastify.post(
    "/change-password",
    { schema: { body: ChangePasswordBody }, preHandler: app.verifyAdminJwt },
    async (request, reply) => {
      const payload = request.user as { sub: string };
      const admin = await findAdminById(db, BigInt(payload.sub));
      if (!admin || !admin.active) {
        return reply.code(401).send({ code: "unauthorized" });
      }
      const ok = await verifyPassword(admin.passwordHash, request.body.currentPassword);
      if (!ok) {
        return reply.code(400).send({ code: "invalid_current_password" });
      }
      await changeAdminPassword(db, admin.id, request.body.newPassword);
      return { ok: true };
    },
  );

  fastify.post("/logout", async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (sessionToken) await revokeAdminSession(db, sessionToken);

    clearAuthCookies(reply);
    return { ok: true };
  });

  /* ── Admin management (guarded by manage_admins) ────────────────────────── */

  fastify.get(
    "/users",
    { preHandler: [app.verifyAdminJwt, app.requirePermission("manage_admins")] },
    async () => {
      const admins = await listAdminUsers(db);
      return {
        users: admins.map((a) => ({
          id: a.id.toString(),
          email: a.email,
          fullName: a.fullName,
          roleId: a.roleId ? a.roleId.toString() : null,
          active: a.active,
        })),
      };
    },
  );

  fastify.post(
    "/users",
    {
      schema: { body: CreateAdminBody },
      preHandler: [app.verifyAdminJwt, app.requirePermission("manage_admins")],
    },
    async (request, reply) => {
      const existing = await findAdminByEmail(db, request.body.email);
      if (existing) return reply.code(409).send({ code: "email_taken" });

      const role = await findRoleById(db, BigInt(request.body.roleId));
      if (!role || role.platform !== "admin") {
        return reply.code(400).send({ code: "invalid_role" });
      }

      // Only a Superadmin may mint another Superadmin.
      const requester = request.user as { sub: string; roleId: string | null };
      if (role.isSuperadmin && !(await requesterIsSuperadmin(requester.roleId))) {
        return reply.code(403).send({ code: "forbidden" });
      }

      const admin = await createAdminUser(db, {
        email: request.body.email,
        password: request.body.password,
        fullName: request.body.fullName,
        roleId: role.id,
        createdById: BigInt(requester.sub),
      });

      return { user: await serializeAdmin(db, admin) };
    },
  );

  fastify.patch(
    "/users/:id/role",
    {
      schema: { params: IdParams, body: SetRoleBody },
      preHandler: [app.verifyAdminJwt, app.requirePermission("manage_admins")],
    },
    async (request, reply) => {
      const targetId = BigInt(request.params.id);
      const target = await findAdminById(db, targetId);
      if (!target) return reply.code(404).send({ code: "not_found" });

      const newRole = await findRoleById(db, BigInt(request.body.roleId));
      if (!newRole || newRole.platform !== "admin") {
        return reply.code(400).send({ code: "invalid_role" });
      }

      const requester = request.user as { roleId: string | null };
      const requesterSuper = await requesterIsSuperadmin(requester.roleId);

      // Only a Superadmin may grant the Superadmin role.
      if (newRole.isSuperadmin && !requesterSuper) {
        return reply.code(403).send({ code: "forbidden" });
      }

      // Never demote the last remaining Superadmin.
      if (target.roleId && !newRole.isSuperadmin) {
        const currentRole = await findRoleById(db, target.roleId);
        if (currentRole?.isSuperadmin && (await countActiveSuperadmins(db)) <= 1) {
          return reply.code(409).send({ code: "last_superadmin" });
        }
      }

      const updated = await setAdminRole(db, targetId, newRole.id);
      if (!updated) return reply.code(404).send({ code: "not_found" });
      return { user: await serializeAdmin(db, updated) };
    },
  );
}
