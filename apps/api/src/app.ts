import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import dbPlugin from "./plugins/db.js";
import cookiePlugin from "./plugins/cookie.js";
import jwtPlugin from "./plugins/jwt.js";
import healthRoutes from "./routes/health.js";
import { authModule } from "./modules/index.js";
import { env } from "./env.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: [
      "http://localhost:5174", // merchant-app
      "http://localhost:5175", // client-portal
      "http://localhost:5176", // platform-admin (if needed)
    ],
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(sensible);
  await app.register(cookiePlugin);
  await app.register(jwtPlugin);
  await app.register(dbPlugin);

  // domain modules register here as encapsulated plugins
  await app.register(healthRoutes);
  await app.register(authModule, { prefix: "/" });

  return app;
}
