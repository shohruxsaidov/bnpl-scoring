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
} from "./service/service.handler";
import { db } from "@db";
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

function buildAccessToken(app: FastifyInstance, adminId: number, roleId: number | null): string {
  return app.jwt.sign(
    { sub: adminId.toString(), type: "admin", roleId: roleId ? roleId.toString() : null },
    { expiresIn: ACCESS_MAX_AGE },
  );
}

function setAuthCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  adminId: number,
  roleId: number | null,
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

type AdminRow = { id: number; email: string; fullName: string; roleId: number | null; mustChangePassword: boolean };

// Serializes an admin together with the Feature set its Role grants, so the
// frontend can drive UI from `permissions`.
async function serializeAdmin(admin: AdminRow) {
  let isSuperAdmin = false;
  let roleKey: string | null = null;
  let roleName: string | null = null;
  let features: string[] = [];

  if (admin.roleId) {
    const role = await findRoleById(db, admin.roleId);
    if (role) {
      isSuperAdmin = role.isSuperAdmin;
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
    isSuperAdmin,
    mustChangePassword: admin.mustChangePassword,
    permissions: effectiveFeatures("admin", { isSuperAdmin, features }),
  };
}

export default async function adminAuthRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  const TAGS = ["Auth · Admin"];

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
    const resolved = await app.resolveRole(Number(roleId));
    return resolved?.isSuperAdmin ?? false;
  }

  /* ── Login ──────────────────────────────────────────────────────────────── */

  fastify.post("/login", { schema: { tags: TAGS, body: LoginBody } }, async (request, reply) => {
    const admin = await findAdminByEmail(request.body.email);

    if (!admin || !admin.active) {
      return reply.code(401).sendError("invalid_credentials");
    }

    const ok = await verifyPassword(admin.passwordHash, request.body.password);
    if (!ok) {
      return reply.code(401).sendError("invalid_credentials");
    }

    const { sessionToken } = await createAdminSession(admin.id);
    setAuthCookies(app, reply, admin.id, admin.roleId, sessionToken);

    return { user: await serializeAdmin(admin) };
  });

  /* ── Session lifecycle ──────────────────────────────────────────────────── */

  fastify.get("/me", { schema: { tags: TAGS }, preHandler: app.verifyAdminJwt }, async (request, reply) => {
    const payload = request.user as { sub: string; type: "admin" };
    const admin = await findAdminById(Number(payload.sub));
    if (!admin || !admin.active) {
      return reply.code(401).sendError("unauthorized");
    }
    return { user: await serializeAdmin(admin) };
  });

  fastify.post("/refresh", { schema: { tags: TAGS } }, async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (!sessionToken) return reply.code(401).sendError("unauthorized");

    const result = await verifyAdminSession(sessionToken);
    if (!result) {
      clearAuthCookies(reply);
      return reply.code(401).sendError("unauthorized");
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
    { schema: { tags: TAGS, body: ChangePasswordBody }, preHandler: app.verifyAdminJwt },
    async (request, reply) => {
      const payload = request.user as { sub: string };
      const admin = await findAdminById(Number(payload.sub));
      if (!admin || !admin.active) {
        return reply.code(401).sendError("unauthorized");
      }
      const ok = await verifyPassword(admin.passwordHash, request.body.currentPassword);
      if (!ok) {
        return reply.code(400).sendError("invalid_current_password");
      }
      await changeAdminPassword(admin.id, request.body.newPassword);
      return { ok: true };
    },
  );

  fastify.post("/logout", { schema: { tags: TAGS } }, async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (sessionToken) await revokeAdminSession(sessionToken);

    clearAuthCookies(reply);
    return { ok: true };
  });

  /* ── Admin management (guarded by manage_admins) ────────────────────────── */

  fastify.get(
    "/users",
    { schema: { tags: TAGS }, preHandler: [app.verifyAdminJwt, app.requirePermission("manage_admins")] },
    async () => {
      const admins = await listAdminUsers();
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
      schema: { tags: TAGS, body: CreateAdminBody },
      preHandler: [app.verifyAdminJwt, app.requirePermission("manage_admins")],
    },
    async (request, reply) => {
      const existing = await findAdminByEmail(request.body.email);
      if (existing) return reply.code(409).sendError("email_taken");

      const role = await findRoleById(db, Number(request.body.roleId));
      if (!role || role.platform !== "admin") {
        return reply.code(400).sendError("invalid_role");
      }

      // Only a Superadmin may mint another Superadmin.
      const requester = request.user as { sub: string; roleId: string | null };
      if (role.isSuperAdmin && !(await requesterIsSuperadmin(requester.roleId))) {
        return reply.code(403).sendError("forbidden");
      }

      const admin = await createAdminUser({
        email: request.body.email,
        password: request.body.password,
        fullName: request.body.fullName,
        roleId: role.id,
        createdById: Number(requester.sub),
      });

      return { user: await serializeAdmin(admin) };
    },
  );

  fastify.patch(
    "/users/:id/role",
    {
      schema: { tags: TAGS, params: IdParams, body: SetRoleBody },
      preHandler: [app.verifyAdminJwt, app.requirePermission("manage_admins")],
    },
    async (request, reply) => {
      const targetId = Number(request.params.id);
      const target = await findAdminById(targetId);
      if (!target) return reply.code(404).sendError("not_found");

      const newRole = await findRoleById(db, Number(request.body.roleId));
      if (!newRole || newRole.platform !== "admin") {
        return reply.code(400).sendError("invalid_role");
      }

      const requester = request.user as { roleId: string | null };
      const requesterSuper = await requesterIsSuperadmin(requester.roleId);

      // Only a Superadmin may grant the Superadmin role.
      if (newRole.isSuperAdmin && !requesterSuper) {
        return reply.code(403).sendError("forbidden");
      }

      // Never demote the last remaining Superadmin.
      if (target.roleId && !newRole.isSuperAdmin) {
        const currentRole = await findRoleById(db, target.roleId);
        if (currentRole?.isSuperAdmin && (await countActiveSuperadmins()) <= 1) {
          return reply.code(409).sendError("last_superadmin");
        }
      }

      const updated = await setAdminRole(targetId, newRole.id);
      if (!updated) return reply.code(404).sendError("not_found");
      return { user: await serializeAdmin(updated) };
    },
  );
}
