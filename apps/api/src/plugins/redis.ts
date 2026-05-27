import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";
import { env } from "../env";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async function redisPlugin(app: FastifyInstance) {
  const client = new Redis(env.REDIS_URL, {
    family: 4,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    enableOfflineQueue: false,
  });

  client.on("error", (err) => app.log.warn({ err }, "Redis error"));

  app.decorate("redis", client);
  app.addHook("onClose", async () => {
    await client.quit();
  });
});
