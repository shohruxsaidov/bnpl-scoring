/** Single pg Pool + Drizzle instance for the whole process. */

import { createDb, createPool } from "@scoring/db";
import { config } from "../config.js";

export const pool = createPool(config.databaseUrl);
export const db = createDb(pool);

export async function closeDb(): Promise<void> {
  await pool.end();
}
