import 'dotenv/config'
import { desc } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { scoringModelRevisions } from '../modules/admin/scoringModel/db/schema'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const client = postgres(process.env['DATABASE_URL']!)
const db = drizzle(client)

async function main() {
  const [existing] = await db
    .select({ id: scoringModelRevisions.id })
    .from(scoringModelRevisions)
    .orderBy(desc(scoringModelRevisions.id))
    .limit(1)

  if (existing) {
    console.log(`Scoring model already seeded (revision #${existing.id}). Skipping.`)
    await client.end()
    return
  }

  const jsonPath = resolve(process.cwd(), '../../finsuminpsgnk.json')
  const raw = readFileSync(jsonPath, 'utf-8')
  const json = JSON.parse(raw)
  const params = json['FinsumInpsGnkScoringModelParams']

  const [row] = await db
    .insert(scoringModelRevisions)
    .values({ name: 'FinsumInpsGnk', version: '1.0', params, createdBy: null })
    .returning({ id: scoringModelRevisions.id })

  console.log(`Scoring model seeded as revision #${row!.id}`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
