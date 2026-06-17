import { sql } from "drizzle-orm"
import { db } from '@db'
import { clients } from '@db/schema'

export async function listUniqueClients() {
  return db.execute<{
    id: string
    pinfl: string
    phone: string
    first_name: string
    last_name: string
    middle_name: string | null
    birth_date: string
    created_at: string
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
  `)
}
