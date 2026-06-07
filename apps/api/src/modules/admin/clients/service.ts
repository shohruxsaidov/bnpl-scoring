import { sql } from "drizzle-orm";
import type { Db } from "../../../db/index.js";
import { clients } from "../../id/db/schema.js";

export async function listUniqueClients(db: Db) {
  // One row per unique PINFL — pick the earliest record (first time this person
  // appeared in the platform). Personal data is identical across merchants since
  // it originates from MyID.
  return db.execute<{
    id: string;
    pinfl: string;
    phone: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    birth_date: string;
    created_at: string;
  }>(sql`
    SELECT DISTINCT ON (${clients.pinfl})
      ${clients.id}::text        AS id,
      ${clients.pinfl}           AS pinfl,
      ${clients.phone}           AS phone,
      ${clients.firstName}       AS first_name,
      ${clients.lastName}        AS last_name,
      ${clients.middleName}      AS middle_name,
      ${clients.birthDate}       AS birth_date,
      ${clients.createdAt}       AS created_at
    FROM ${clients}
    ORDER BY ${clients.pinfl}, ${clients.createdAt} ASC
  `);
}
