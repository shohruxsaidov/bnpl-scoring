import { desc } from "drizzle-orm"
import type { Db } from "../../../../db"
import { tariffs } from "../../../id/db/schema"

export async function listTariffs(db: Db) {
  return db.select().from(tariffs).orderBy(desc(tariffs.createdAt))
}
