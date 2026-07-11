import { db } from "@db"
import {
  CONFIGURABLE_PIPELINES,
  DEFAULT_PIPELINE_ENABLED,
  PIPELINE_FEEDS_LIMIT,
  PIPELINE_SCORING_PARAMS,
  PIPELINE_STOP_FACTORS,
  isConfigurablePipeline,
  type ConfigurablePipeline,
} from "../../../../scoring/pipelines/config"
import { scoringPipelineSettings } from "../../schema"

export interface PipelineSetting {
  type: ConfigurablePipeline
  enabled: boolean
  /** No stored row yet — `enabled` is the catalog default, not an admin choice. */
  isDefault: boolean
  updatedAt: Date | null
  /** Scoring params that go unscored when this pipeline is off. */
  scoringParams: readonly string[]
  /** Model stop-factors that stop firing when this pipeline is off. */
  stopFactors: readonly string[]
  /** True when the credit-limit formula itself consumes this pipeline's data. */
  feedsLimit: boolean
}

// Returns every configurable pipeline in PIPELINE_ORDER, whether or not it has a
// stored row. A pipeline with no row is reported at its catalog default — absence
// means "never configured", not "disabled".
export async function listPipelineSettings(): Promise<PipelineSetting[]> {
  const rows = await db.select().from(scoringPipelineSettings)

  const stored = new Map(
    rows.filter((r) => isConfigurablePipeline(r.type)).map((r) => [r.type, r]),
  )

  return CONFIGURABLE_PIPELINES.map((type) => {
    const row = stored.get(type)
    return {
      type,
      enabled: row ? row.enabled : DEFAULT_PIPELINE_ENABLED[type],
      isDefault: !row,
      updatedAt: row?.updatedAt ?? null,
      scoringParams: PIPELINE_SCORING_PARAMS[type],
      stopFactors: PIPELINE_STOP_FACTORS[type],
      feedsLimit: PIPELINE_FEEDS_LIMIT[type],
    }
  })
}
