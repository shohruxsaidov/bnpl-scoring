import { desc, eq } from 'drizzle-orm'
import type { Db } from '../../../db/index.js'
import { tariffs } from '../../id/db/schema.js'

export async function listTariffs(db: Db) {
  return db.select().from(tariffs).orderBy(desc(tariffs.createdAt))
}

export async function getTariff(db: Db, id: bigint) {
  const [row] = await db.select().from(tariffs).where(eq(tariffs.id, id)).limit(1)
  return row
}

export async function createTariff(
  db: Db,
  input: { name: string; termMonths: number; markupPercent: string; creditMin: bigint; creditMax: bigint },
) {
  const [row] = await db.insert(tariffs).values(input).returning()
  return row!
}

export async function updateTariff(
  db: Db,
  id: bigint,
  input: Partial<{ name: string; termMonths: number; markupPercent: string; creditMin: bigint; creditMax: bigint; active: boolean }>,
) {
  const [row] = await db.update(tariffs).set(input).where(eq(tariffs.id, id)).returning()
  return row
}
