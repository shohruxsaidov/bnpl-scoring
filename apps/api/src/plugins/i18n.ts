import fp from 'fastify-plugin';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { resolveLang, translate } from '../i18n/index';

declare module 'fastify' {
  interface FastifyReply {
    sendError(code: string, args?: Record<string, unknown>): FastifyReply;
  }
}

export default fp(async function i18nPlugin(app) {
  app.decorateReply(
    'sendError',
    function (this: FastifyReply, code: string, args: Record<string, unknown> = {}) {
      const lang = resolveLang(this.request.headers['x-lang'] as string | undefined);
      const message = translate(lang, code, args);
      return this.send({ code, message, args });
    },
  );

  app.setErrorHandler(function (
    err: FastifyError & { args?: Record<string, unknown> },
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const statusCode = err.statusCode ?? 500;
    const code = statusCode >= 500 ? 'internal_error' : err.message || 'internal_error';
    const args = err.args ?? {};
    const lang = resolveLang(request.headers['x-lang'] as string | undefined);
    const message = translate(lang, code, args);

    app.log.error({ err, code }, 'request error');
    reply.code(statusCode).send({ code, message, args });
  });
});
