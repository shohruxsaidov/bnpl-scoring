import type { Db } from "../../../../db"
import { organization } from "../db/schema"

export async function getOrganization(db: Db) {
  const [row] = await db.select().from(organization).limit(1)
  return row ?? null
}
