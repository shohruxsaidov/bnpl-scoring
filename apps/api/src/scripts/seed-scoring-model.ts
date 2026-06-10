import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { scoringModels, scoringModelRevisions } from '../modules/admin/scoringModel/db/schema'
import { tariffs } from '../modules/id/db/schema'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const client = postgres(process.env['DATABASE_URL']!)
const db = drizzle(client)

async function main() {
  const jsonPath = resolve(process.cwd(), '../../finsuminpsgnk.json')
  const raw = readFileSync(jsonPath, 'utf-8')
  const json = JSON.parse(raw)

  const { Metadata, StopFactors, ScoringParams, LimitCoefficient } = json
  const name: string = Metadata.ModelName
  const version: string = Metadata.ModelVersion
  const params = { StopFactors, ScoringParams, LimitCoefficient }

  // Clear old data — tariffs first (FK), then revisions.
  // merchantTariffs cascade-deletes when tariffs are removed.
  await db.delete(tariffs)
  await db.delete(scoringModelRevisions)

  // ADR-0023: revisions belong to a Scoring Model; seed into the Global Model.
  let [global] = await db
    .select()
    .from(scoringModels)
    .where(eq(scoringModels.isGlobal, true))
    .limit(1)
  if (!global) {
    const [created] = await db
      .insert(scoringModels)
      .values({ name, isGlobal: true })
      .returning()
    global = created!
  }

  const [row] = await db
    .insert(scoringModelRevisions)
    .values({ scoringModelId: global.id, name, version, params, createdBy: null })
    .returning({ id: scoringModelRevisions.id })

  console.log(
    `Scoring model seeded as revision #${row!.id} (${name} v${version}) under Global Model #${global.id}`,
  )
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
