import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import fastifyOtel from "@fastify/otel";
import { trace } from "@opentelemetry/api";
import pino from "pino";
import dbPlugin from "./plugins/db.js";
import cookiePlugin from "./plugins/cookie.js";
import jwtPlugin from "./plugins/jwt.js";
import permissionsPlugin from "./plugins/permissions";
import minioPlugin from "./plugins/minio";
import redisPlugin from "./plugins/redis";
import queuePlugin from "./plugins/queue";
import i18nPlugin from "./plugins/i18n";
import healthRoutes from "./routes/health.js";
import { authModule, merchantModule, adminModule, notificationsModule, clientModule, pushModule } from "./modules/index.js";
import { env } from "./env.js";

const isDev = env.NODE_ENV !== "production";

function buildTransport() {
  if (isDev) {
    return {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
          singleLine: false,
        },
      },
    };
  }
  if (env.LOKI_URL) {
    return {
      transport: {
        target: "pino-loki",
        options: {
          host: env.LOKI_URL,
          labels: { app: env.OTEL_SERVICE_NAME, env: "production" },
          batching: true,
          interval: 5,
        },
      },
    };
  }
  return {};
}

const logger = {
  level: isDev ? "debug" : "info",
  mixin() {
    const span = trace.getActiveSpan();
    if (!span?.isRecording()) return {};
    const { traceId, spanId } = span.spanContext();
    return { traceId, spanId };
  },
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
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.code",
      "req.body.regToken",
      "req.body.pickerToken",
    ],
    censor: "[REDACTED]",
  },
};

export async function buildApp() {
  const app = Fastify({ logger, trustProxy: true });

  await app.register(new fastifyOtel().plugin());
  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(sensible);
  await app.register(i18nPlugin);
  await app.register(cookiePlugin);
  await app.register(jwtPlugin);
  await app.register(dbPlugin);
  await app.register(permissionsPlugin);
  await app.register(redisPlugin);
  await app.register(minioPlugin);
  await app.register(queuePlugin);

  // domain modules register here as encapsulated plugins
  await app.register(healthRoutes);
  await app.register(authModule, { prefix: "/api/v1" });
  await app.register(merchantModule, { prefix: "/api/v1" });
  await app.register(adminModule, { prefix: "/api/v1" });
  await app.register(notificationsModule, { prefix: "/api/v1" });
  await app.register(clientModule, { prefix: "/api/v1" });
  await app.register(pushModule, { prefix: "/api/v1" });

  return app;
}
