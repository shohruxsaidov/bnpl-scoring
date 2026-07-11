// ---------------------------------------------------------------------------
// Runtime read of the ops kill-switch (scoring_pipeline_settings).
//
// The admin UI has been able to toggle these for a while, but nothing in the
// scoring runtime consulted them — the switches were decorative. plum_card is
// the first pipeline to honour its switch, so it can be stopped from the admin
// panel without a deploy if the vendor calls misbehave.
//
// A pipeline with no row falls back to DEFAULT_PIPELINE_ENABLED: absence means
// "default", NOT "disabled".
// ---------------------------------------------------------------------------
import { eq } from 'drizzle-orm';
import { db } from '@db';
import { scoringPipelineSettings } from '@db/scoring-pipeline-settings';
import { DEFAULT_PIPELINE_ENABLED, type ConfigurablePipeline } from './config';

export async function isPipelineEnabled(type: ConfigurablePipeline): Promise<boolean> {
  const [row] = await db
    .select({ enabled: scoringPipelineSettings.enabled })
    .from(scoringPipelineSettings)
    .where(eq(scoringPipelineSettings.type, type))
    .limit(1);
  return row ? row.enabled : DEFAULT_PIPELINE_ENABLED[type];
}
