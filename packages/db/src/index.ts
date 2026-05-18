/**
 * @scoring/db — Drizzle client factory + schema re-export.
 * The api owns the single pool singleton (see apps/api/src/shared/db.ts);
 * this package only exposes the schema and a factory.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

export type Database = ReturnType<typeof createDb>;

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function createDb(pool: Pool) {
  return drizzle(pool, { schema });
}
