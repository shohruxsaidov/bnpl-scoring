import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { desc, eq, isNull } from 'drizzle-orm'
import { scoringModels, scoringModelRevisions } from '@db/schema'

// ADR-0023 backfill: ensure exactly one Global Model exists and attach every
// orphan revision (pre-ADR rows with scoring_model_id = null) to it.
// Idempotent — safe to re-run.
const client = postgres(process.env['DATABASE_URL']!)
const db = drizzle(client)

async function main() {
  let [global] = await db
    .select()
    .from(scoringModels)
    .where(eq(scoringModels.isGlobal, true))
    .limit(1)

  if (!global) {
    // Name the model after the most recent revision when one exists.
    const [latest] = await db
      .select({ name: scoringModelRevisions.name })
      .from(scoringModelRevisions)
      .orderBy(desc(scoringModelRevisions.id))
      .limit(1)

    const [created] = await db
      .insert(scoringModels)
      .values({ name: latest?.name ?? 'Default', isGlobal: true })
      .returning()
    global = created!
    console.log(`Created Global Model #${global.id} ("${global.name}")`)
  } else {
    console.log(`Global Model already present: #${global.id} ("${global.name}")`)
  }

  const orphans = await db
    .update(scoringModelRevisions)
    .set({ scoringModelId: global.id })
    .where(isNull(scoringModelRevisions.scoringModelId))
    .returning({ id: scoringModelRevisions.id })

  console.log(`Attached ${orphans.length} orphan revision(s) to the Global Model`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
