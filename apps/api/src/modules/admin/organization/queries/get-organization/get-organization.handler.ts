import { db } from "@db"
import { organization } from "../../schema"

export async function getOrganization() {
  const [row] = await db.select().from(organization).limit(1)
  return row ?? null
}
