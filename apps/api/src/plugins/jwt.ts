import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    verifyClientJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyAdminJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyMerchantJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user:
      | { sub: string; type: 'client' }
      | { sub: string; type: 'admin'; roleId: string | null }
      | {
          sub: string;
          type: 'merchant';
          merchantId: string;
          branchId: string;
          role: string;
          roleId: string;
        };
  }
}

export default fp(async function jwtPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  app.decorate('verifyClientJwt', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
      // Reject admin/merchant tokens signed with the same secret — a cross-actor
      // token must never resolve a client identity.
      if (request.user.type !== 'client') throw new Error('wrong type');
    } catch (err) {
      await reply.code(401).send({ code: 'unauthorized' });
    }
  });

  app.decorate('verifyAdminJwt', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.cookies['admin_access_token'];
      if (!token) throw new Error('missing token');
      const payload = app.jwt.verify<{ sub: string; type: 'admin'; roleId: string | null }>(token);
      if (payload.type !== 'admin') throw new Error('wrong type');
      request.user = payload;
    } catch {
      await reply.code(401).send({ code: 'unauthorized' });
    }
  });

  app.decorate('verifyMerchantJwt', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.cookies['merchant_access_token'];
      if (!token) throw new Error('missing token');
      const payload = app.jwt.verify<{
        sub: string;
        type: 'merchant';
        merchantId: string;
        branchId: string;
        role: string;
        roleId: string;
      }>(token);
      if (payload.type !== 'merchant') throw new Error('wrong type');
      request.user = payload;
    } catch {
      await reply.code(401).send({ code: 'unauthorized' });
    }
  });
});
