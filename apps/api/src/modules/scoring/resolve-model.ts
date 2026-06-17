import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { merchants, scoringModels, scoringModelRevisions } from '../id/db/schema';
import type { ScoringModelData } from './engine';

export interface ResolvedScoringModel {
  model: typeof scoringModels.$inferSelect;
  revision: typeof scoringModelRevisions.$inferSelect;
  params: ScoringModelData;
}

async function latestRevision(db: Db, scoringModelId: number) {
  const [row] = await db
    .select()
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.scoringModelId, scoringModelId))
    .orderBy(desc(scoringModelRevisions.id))
    .limit(1);
  return row ?? null;
}

// ADR-0023 resolution rule: the Merchant's assigned Scoring Model, else the
// Global Model; then that model's latest (= active) revision. An assigned
// model with no revisions falls back to the Global Model rather than failing
// the scoring run. Returns null only when no usable revision exists at all
// (backfill not run / empty database).
export async function resolveScoringModel(
  db: Db,
  merchantId?: number,
): Promise<ResolvedScoringModel | null> {
  if (merchantId !== undefined) {
    const [merchant] = await db
      .select({ scoringModelId: merchants.scoringModelId })
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    if (merchant?.scoringModelId != null) {
      const [model] = await db
        .select()
        .from(scoringModels)
        .where(eq(scoringModels.id, merchant.scoringModelId))
        .limit(1);
      if (model) {
        const revision = await latestRevision(db, model.id);
        if (revision) {
          return { model, revision, params: revision.params as unknown as ScoringModelData };
        }
      }
    }
  }

  const [global] = await db
    .select()
    .from(scoringModels)
    .where(eq(scoringModels.isGlobal, true))
    .limit(1);
  if (!global) return null;

  const revision = await latestRevision(db, global.id);
  if (!revision) return null;
  return { model: global, revision, params: revision.params as unknown as ScoringModelData };
}
