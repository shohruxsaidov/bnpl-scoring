import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import type { Db } from "../db/index.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

export default fp(async function dbPlugin(app: FastifyInstance) {
  app.decorate("db", db);
});
