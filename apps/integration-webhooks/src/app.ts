import pino from 'pino';
import Fastify from 'fastify';
import autoPayModule from './modules/autopay';

import { env } from './env';

const isDev = env.NODE_ENV !== 'production';

function buildTransport() {
  if (isDev) {
    return {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    };
  }
  if (env.LOKI_URL) {
    return {
      transport: {
        target: 'pino-loki',
        options: {
          host: env.LOKI_URL,
          labels: { app: env.OTEL_SERVICE_NAME, env: 'production' },
          batching: true,
          interval: 5,
        },
      },
    };
  }
  return {};
}

const logger = {
  level: isDev ? 'debug' : 'info',

  serializers: {
    err: (err: Error & { body?: unknown; statusCode?: number }) => {
      const base = pino.stdSerializers.err(err);
      if (err.body !== undefined) {
        return { ...base, body: err.body, statusCode: err.statusCode };
      }
      return base;
    },
  },
  ...buildTransport(),
  redact: {
    paths: [],
    censor: '[REDACTED]',
  },
};

export async function buildApp() {
  const app = Fastify({ logger, trustProxy: true });
  await app.register(autoPayModule, {
    prefix: '/webhooks/autopay',
  });

  return app;
}
