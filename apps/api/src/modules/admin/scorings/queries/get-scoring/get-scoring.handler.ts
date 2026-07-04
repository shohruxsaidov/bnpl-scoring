import { asc, eq } from 'drizzle-orm';
import { db } from '@db';
import { scorings } from '@db/scorings';
import { scoringPipelines } from '@db/scoring-pipelines';
import { users } from '@db/users';

// Execution order — drives the tab order on the admin detail page. Any pipeline
// type not listed here sorts last (stable by id), so new types degrade gracefully.
const PIPELINE_ORDER: Record<string, number> = {
  myid: 0,
  katm_claim: 1,
  katm_mib: 2,
  katm_077: 3,
  katm_inps: 4,
  model_score: 5,
};

export interface ScoringDetailPipeline {
  id: number;
  type: string;
  status: string;
  rejectReasonCode: string | null;
  summary: unknown;
  raw: unknown;
  createdAt: string;
}

export interface ScoringDetail {
  id: number;
  userId: number | null;
  fullName: string | null;
  phone: string | null;
  status: string;
  score: number | null;
  creditLimit: number | null;
  currentPipeline: string | null;
  katmClaimId: string | null;
  rejectReasonCode: string | null;
  createdAt: string;
  updatedAt: string;
  pipelines: ScoringDetailPipeline[];
}

export async function getScoring(id: number): Promise<ScoringDetail | null> {
  const [row] = await db
    .select({
      id: scorings.id,
      userId: scorings.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      status: scorings.status,
      score: scorings.score,
      creditLimit: scorings.creditLimit,
      currentPipeline: scorings.currentPipeline,
      katmClaimId: scorings.katmClaimId,
      rejectReasonCode: scorings.rejectReasonCode,
      createdAt: scorings.createdAt,
      updatedAt: scorings.updatedAt,
    })
    .from(scorings)
    .leftJoin(users, eq(scorings.userId, users.id))
    .where(eq(scorings.id, id))
    .limit(1);

  if (!row) return null;

  const pipelineRows = await db
    .select({
      id: scoringPipelines.id,
      type: scoringPipelines.type,
      status: scoringPipelines.status,
      rejectReasonCode: scoringPipelines.rejectReasonCode,
      summary: scoringPipelines.summary,
      raw: scoringPipelines.raw,
      createdAt: scoringPipelines.createdAt,
    })
    .from(scoringPipelines)
    .where(eq(scoringPipelines.scoringId, id))
    .orderBy(asc(scoringPipelines.id));

  const pipelines = pipelineRows
    .map((p) => ({
      id: p.id,
      type: p.type,
      status: p.status,
      rejectReasonCode: p.rejectReasonCode,
      summary: p.summary,
      raw: p.raw,
      createdAt: p.createdAt.toISOString(),
    }))
    .sort(
      (a, b) =>
        (PIPELINE_ORDER[a.type] ?? 99) - (PIPELINE_ORDER[b.type] ?? 99) || a.id - b.id,
    );

  return {
    id: row.id,
    userId: row.userId,
    fullName:
      row.firstName != null || row.lastName != null
        ? [row.firstName, row.lastName].filter(Boolean).join(' ')
        : null,
    phone: row.phone,
    status: row.status,
    score: row.score,
    creditLimit: row.creditLimit,
    currentPipeline: row.currentPipeline,
    katmClaimId: row.katmClaimId,
    rejectReasonCode: row.rejectReasonCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pipelines,
  };
}
