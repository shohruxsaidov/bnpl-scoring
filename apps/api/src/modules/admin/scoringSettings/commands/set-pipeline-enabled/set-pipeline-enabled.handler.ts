import { sql } from "drizzle-orm"
import { db } from "@db"
import { scoringPipelineSettings } from "../../schema"
import type { SetPipelineEnabledInput } from "./set-pipeline-enabled.command"

// Upsert by pipeline type. The first flip of a pipeline materialises its row;
// from then on the stored value wins over the catalog default.
export async function setPipelineEnabled(input: SetPipelineEnabledInput) {
  const [row] = await db
    .insert(scoringPipelineSettings)
    .values({
      type: input.type,
      enabled: input.enabled,
      updatedBy: input.actorId,
    })
    .onConflictDoUpdate({
      target: scoringPipelineSettings.type,
      set: {
        enabled: input.enabled,
        updatedBy: input.actorId,
        updatedAt: sql`now()`,
      },
    })
    .returning()

  return row
}
