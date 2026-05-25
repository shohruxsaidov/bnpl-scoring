import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import dbPlugin from "./plugins/db.js";
import cookiePlugin from "./plugins/cookie.js";
import jwtPlugin from "./plugins/jwt.js";
import minioPlugin from "./plugins/minio";
import healthRoutes from "./routes/health.js";
import { authModule, merchantModule, adminModule } from "./modules/index.js";
import { env } from "./env.js";

const isDev = env.NODE_ENV !== "production";

const logger = {
  level: isDev ? "debug" : "info",
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
            singleLine: false,
          },
        },
      }
    : {}),
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
  const app = Fastify({ logger });

  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(sensible);
  await app.register(cookiePlugin);
  await app.register(jwtPlugin);
  await app.register(dbPlugin);
  await app.register(minioPlugin);

  // domain modules register here as encapsulated plugins
  await app.register(healthRoutes);
  await app.register(authModule, { prefix: "/" });
  await app.register(merchantModule, { prefix: "/" });
  await app.register(adminModule, { prefix: "/" });

  return app;
}
