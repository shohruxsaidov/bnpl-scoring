import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { env } from '../../../env';
import type { Db } from '../../../db/index';
import { findRoleByKey, listRoleFeatures } from '../../../rbac/service';
import {
  changeMerchantPassword,
  createMerchantSession,
  findMerchantUserByPhone,
  findMerchantUserById,
  revokeMerchantSession,
  verifyMerchantSession,
  verifyPassword,
  type MerchantRole,
} from './service';

const ACCESS_MAX_AGE = 15 * 60;
const SESSION_MAX_AGE = env.SESSION_EXPIRES_DAYS * 24 * 60 * 60;

const isProd = env.NODE_ENV === 'production';

const baseCookie = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProd,
  path: '/',
};

// Prefixed to avoid collisions with client portal cookies.
const ACCESS_COOKIE = 'merchant_access_token';
const SESSION_COOKIE = 'merchant_session_id';

interface PickerToken {
  employeeId: string;
  roles: MerchantRole[];
  merchantId: string;
  branchId: string;
  step: 'role_selection';
}

function buildAccessToken(
  app: FastifyInstance,
  employee: { id: bigint; merchantId: bigint; branchId: bigint },
  role: string,
  roleId: bigint,
): string {
  return app.jwt.sign(
    {
      sub: employee.id.toString(),
      merchantId: employee.merchantId.toString(),
      branchId: employee.branchId.toString(),
      role,
      roleId: roleId.toString(),
      type: 'merchant',
    },
    { expiresIn: ACCESS_MAX_AGE },
  );
}

function setAuthCookies(
  app: FastifyInstance,
  reply: FastifyReply,
  employee: { id: bigint; merchantId: bigint; branchId: bigint },
  role: string,
  roleId: bigint,
  sessionToken: string,
): void {
  reply.setCookie(ACCESS_COOKIE, buildAccessToken(app, employee, role, roleId), {
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
    phone: string;
    merchantId: bigint;
    branchId: bigint;
    mustChangePassword: boolean;
  },
  role: string,
  roleId: bigint,
  permissions: string[],
) {
  return {
    id: employee.id.toString(),
    fullName: employee.fullName,
    phone: employee.phone,
    role,
    roleId: roleId.toString(),
    merchantId: employee.merchantId.toString(),
    branchId: employee.branchId.toString(),
    permissions,
    mustChangePassword: employee.mustChangePassword,
  };
}

// Resolves a merchant Role key to its row + the Features it grants.
async function resolveRoleByKey(db: Db, roleKey: string) {
  const role = await findRoleByKey(db, 'merchant', roleKey);
  if (!role) return undefined;
  const permissions = await listRoleFeatures(db, role.id);
  return { role, permissions };
}

export default async function merchantAuthRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  const LoginBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 1 }),
  });

  const SelectRoleBody = Type.Object({
    pickerToken: Type.String({ minLength: 1 }),
    role: Type.String({ minLength: 1 }),
  });

  /* ── Login ──────────────────────────────────────────────────────────────── */

  fastify.post('/login', { schema: { body: LoginBody } }, async (request, reply) => {
    const employee = await findMerchantUserByPhone(db, request.body.phone);

    if (!employee || !employee.active) {
      return reply.code(401).sendError('invalid_credentials');
    }

    const ok = await verifyPassword(employee.passwordHash, request.body.password);
    if (!ok) {
      return reply.code(401).sendError('invalid_credentials');
    }

    const roles = employee.roles as MerchantRole[];

    if (roles.length === 1) {
      const resolved = await resolveRoleByKey(db, roles[0]!);
      if (!resolved) return reply.code(500).sendError('role_not_configured');
      const { sessionToken } = await createMerchantSession(db, employee.id, roles[0]!);
      setAuthCookies(app, reply, employee, roles[0]!, resolved.role.id, sessionToken);
      return {
        user: serializeEmployee(employee, roles[0]!, resolved.role.id, resolved.permissions),
      };
    }

    // Multiple roles — return picker token instead of issuing a session.
    const pickerToken = app.jwt.sign(
      {
        employeeId: employee.id.toString(),
        roles,
        merchantId: employee.merchantId.toString(),
        branchId: employee.branchId.toString(),
        step: 'role_selection',
      } satisfies PickerToken,
      { expiresIn: '10m' },
    );

    return {
      requiresRolePicker: true,
      roles,
      pickerToken,
      user: {
        id: employee.id.toString(),
        fullName: employee.fullName,
        phone: employee.phone,
      },
    };
  });

  /* ── Role picker ────────────────────────────────────────────────────────── */

  fastify.post('/select-role', { schema: { body: SelectRoleBody } }, async (request, reply) => {
    let payload: PickerToken;
    try {
      payload = app.jwt.verify<PickerToken>(request.body.pickerToken);
    } catch {
      return reply.code(400).sendError('invalid_picker_token');
    }

    if (payload.step !== 'role_selection') {
      return reply.code(400).sendError('invalid_step');
    }

    const role = request.body.role as MerchantRole;
    if (!payload.roles.includes(role)) {
      return reply.code(400).sendError('role_not_allowed');
    }

    const employee = await findMerchantUserById(db, BigInt(payload.employeeId));
    if (!employee || !employee.active) {
      return reply.code(401).sendError('invalid_credentials');
    }

    const resolved = await resolveRoleByKey(db, role);
    if (!resolved) return reply.code(500).sendError('role_not_configured');

    const { sessionToken } = await createMerchantSession(db, employee.id, role);
    setAuthCookies(app, reply, employee, role, resolved.role.id, sessionToken);
    return { user: serializeEmployee(employee, role, resolved.role.id, resolved.permissions) };
  });

  /* ── Session lifecycle ──────────────────────────────────────────────────── */

  fastify.post('/refresh', async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (!sessionToken) return reply.code(401).sendError('unauthorized');

    const result = await verifyMerchantSession(db, sessionToken);
    if (!result) {
      clearAuthCookies(reply);
      return reply.code(401).sendError('unauthorized');
    }

    const resolved = await resolveRoleByKey(db, result.session.selectedRole);
    if (!resolved) {
      clearAuthCookies(reply);
      return reply.code(401).sendError('unauthorized');
    }

    reply.setCookie(
      ACCESS_COOKIE,
      buildAccessToken(app, result.employee, result.session.selectedRole, resolved.role.id),
      { ...baseCookie, maxAge: ACCESS_MAX_AGE },
    );

    return { ok: true };
  });

  fastify.get('/me', { preHandler: app.verifyMerchantJwt }, async (request, reply) => {
    const payload = request.user as {
      sub: string;
      type: 'merchant';
      merchantId: string;
      branchId: string;
      role: string;
      roleId: string;
    };
    const employee = await findMerchantUserById(db, BigInt(payload.sub));
    if (!employee || !employee.active) {
      return reply.code(401).sendError('unauthorized');
    }
    const resolved = await resolveRoleByKey(db, payload.role);
    if (!resolved) return reply.code(500).sendError('role_not_configured');
    return { user: serializeEmployee(employee, payload.role, resolved.role.id, resolved.permissions) };
  });

  /* ── Change password ────────────────────────────────────────────────────── */

  const ChangePasswordBody = Type.Object({
    currentPassword: Type.String({ minLength: 1 }),
    newPassword: Type.String({ minLength: 8 }),
  });

  fastify.post(
    '/change-password',
    { schema: { body: ChangePasswordBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const payload = request.user as { sub: string };
      const employee = await findMerchantUserById(db, BigInt(payload.sub));
      if (!employee || !employee.active) {
        return reply.code(401).sendError('unauthorized');
      }
      const ok = await verifyPassword(employee.passwordHash, request.body.currentPassword);
      if (!ok) {
        return reply.code(400).sendError('invalid_current_password');
      }
      await changeMerchantPassword(db, employee.id, request.body.newPassword);
      return { ok: true };
    },
  );

  fastify.post('/logout', async (request, reply) => {
    const sessionToken = request.cookies[SESSION_COOKIE];
    if (sessionToken) await revokeMerchantSession(db, sessionToken);

    clearAuthCookies(reply);
    return { ok: true };
  });
}
