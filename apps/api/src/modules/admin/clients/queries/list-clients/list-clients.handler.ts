import { sql } from "drizzle-orm"
import { db } from '@db'
import { users } from '@db/schema'

export async function listUniqueUsers() {
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
    SELECT DISTINCT ON (${users.pinfl})
      ${users.id}::text        AS id,
      ${users.pinfl}           AS pinfl,
      ${users.phone}           AS phone,
      ${users.firstName}       AS first_name,
      ${users.lastName}        AS last_name,
      ${users.middleName}      AS middle_name,
      ${users.birthDate}       AS birth_date,
      ${users.createdAt}       AS created_at
    FROM ${users}
    ORDER BY ${users.pinfl}, ${users.createdAt} ASC
  `)
}
