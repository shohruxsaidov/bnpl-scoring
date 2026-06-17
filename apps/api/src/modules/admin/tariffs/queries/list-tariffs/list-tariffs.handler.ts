import { desc } from "drizzle-orm"
import { db } from '@db'
import { tariffs } from '@db/schema'

export async function listTariffs() {
  return db.select().from(tariffs).orderBy(desc(tariffs.createdAt))
}
