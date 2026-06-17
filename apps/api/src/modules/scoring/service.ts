import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { users, clients } from '../id/db/schema';
import { scoringHistories } from '../deals/db/schema';
import { katmSummary } from '../integrations/katm/poller';
import { addCard, confirmCard, scoreCard } from '../integrations/plumgate/service';
import type { KatmResult } from '../integrations/katm/service';
import { scoringSessions, scoringPipelines } from './db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireSession(db: Db, sessionId: string, userId: number) {
  const [session] = await db
    .select()
    .from(scoringSessions)
    .where(and(eq(scoringSessions.id, sessionId), eq(scoringSessions.userId, userId)))
    .limit(1);

  if (!session) throw Object.assign(new Error('session_not_found'), { statusCode: 404 });
  if (session.status !== 'running')
    throw Object.assign(new Error('session_not_running'), { statusCode: 409 });
  return session;
}

async function getPipeline(db: Db, sessionId: string, type: 'katm' | 'card_scoring') {
  const [pipeline] = await db
    .select()
    .from(scoringPipelines)
    .where(and(eq(scoringPipelines.sessionId, sessionId), eq(scoringPipelines.type, type)))
    .limit(1);
  return pipeline ?? null;
}

function computeCoefficient(score: number): number {
  if (score >= 700) return 1.0;
  if (score >= 600) return 0.8;
  return 0;
}

export interface KatmCriteriaDetail {
  katmScore: number;
  katmClass: string;
  scoringLevel: string;
  openCredits: number;
  totalDebt: number;
  overdueInOpenCredits: number;
  totalContracts: number;
  totalClaims: number;
  overdueCount: number;
  maxOverdueDays: number;
  maxOverdueSum: number;
  avgMonthlyPayment: number;
  hasCreditBan: boolean;
}

export interface CardCriteriaDetail {
  score: number;
  limit: number;
  decision: string;
  pcType: 'uzcard' | 'humo';
  bank?: string;
  maskedPan?: string;
  holderName?: string;
}

export interface ClientCriteriaDetail {
  birthDate: string;
  gender: string;
  nationality: string;
}

export interface CriteriaScores {
  katm?: { katmScore: number; detail: KatmCriteriaDetail };
  card?: { score: number; detail: CardCriteriaDetail };
  client?: { detail: ClientCriteriaDetail };
}

function buildCriteriaScores(
  plumResult: { score: number; limit: number; decision: string },
  pcType: 'uzcard' | 'humo',
  katmResult: KatmResult,
  clientData?: ClientCriteriaDetail,
  cardMeta?: { bank?: string; maskedPan?: string; holderName?: string },
): CriteriaScores {
  return {
    katm: {
      katmScore: katmResult.score,
      detail: {
        katmScore: katmResult.score,
        katmClass: katmResult.scoringClass,
        scoringLevel: katmResult.scoringLevel,
        openCredits: katmResult.activeLoans,
        totalDebt: katmResult.allDebtSum,
        overdueInOpenCredits: katmResult.overdueAmount,
        totalContracts: katmResult.totalContracts,
        totalClaims: katmResult.totalClaims,
        overdueCount: katmResult.overdueCount,
        maxOverdueDays: katmResult.maxOverdueDays,
        maxOverdueSum: katmResult.overdueAmount,
        avgMonthlyPayment: katmResult.avgMonthlyPayment,
        hasCreditBan: katmResult.hasCreditBan,
      },
    },
    card: {
      score: plumResult.score,
      detail: {
        score: plumResult.score,
        limit: plumResult.limit,
        decision: plumResult.decision,
        pcType,
        ...cardMeta,
      },
    },
    ...(clientData && { client: { detail: clientData } }),
  };
}

// ---------------------------------------------------------------------------
// Session status — polled by the portal while the KATM report is pending
// ---------------------------------------------------------------------------

export async function getScoringSessionStatus(db: Db, sessionId: string, userId: number) {
  const [session] = await db
    .select()
    .from(scoringSessions)
    .where(and(eq(scoringSessions.id, sessionId), eq(scoringSessions.userId, userId)))
    .limit(1);
  if (!session) throw Object.assign(new Error('session_not_found'), { statusCode: 404 });

  const katmPipeline = await getPipeline(db, sessionId, 'katm');
  const katm =
    katmPipeline?.status === 'completed' && katmPipeline.result
      ? katmSummary(katmPipeline.result as KatmResult)
      : null;

  return {
    sessionId,
    status: session.status,
    katmStatus: katmPipeline?.status ?? 'pending',
    katm,
  };
}

// ---------------------------------------------------------------------------
// Card add: register card in PlumGate, triggers OTP to client's phone
// ---------------------------------------------------------------------------

export async function addScoringCard(
  db: Db,
  input: { sessionId: string; userId: number; cardNumber: string; expiry: string },
) {
  await requireSession(db, input.sessionId, input.userId);

  const katmPipeline = await getPipeline(db, input.sessionId, 'katm');
  if (katmPipeline?.status !== 'completed') {
    throw Object.assign(new Error('katm_not_completed'), { statusCode: 409 });
  }

  const [user] = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) throw Object.assign(new Error('user_not_found'), { statusCode: 404 });

  const result = await addCard(db, {
    clientId: input.userId.toString(),
    phone: user.phone,
    cardNumber: input.cardNumber,
    expiry: input.expiry,
  });

  return result; // { sessionId: plumgateSessionId, maskedPhone }
}

// ---------------------------------------------------------------------------
// Card confirm: submit OTP to complete card registration
// ---------------------------------------------------------------------------

export async function confirmScoringCard(
  db: Db,
  input: { sessionId: string; userId: number; plumgateSessionId: string; otp: string },
) {
  await requireSession(db, input.sessionId, input.userId);

  const card = await confirmCard(db, { sessionId: input.plumgateSessionId, otp: input.otp });
  return { card }; // { plumCardId, maskedPan, holderName, expiry, bank, pcType }
}

// ---------------------------------------------------------------------------
// Card score: run PlumGate scoring, finalize session, write limit + history
// ---------------------------------------------------------------------------

export interface CompleteScoringResult {
  scoreSum: number;
  coefficient: number;
  decision: string;
  platformCreditLimit: number;
  criteriaScores: CriteriaScores;
}

export async function completeScoringCard(
  db: Db,
  input: {
    sessionId: string;
    userId: number;
    plumCardId: string;
    pcType: 'uzcard' | 'humo';
  },
): Promise<CompleteScoringResult> {
  await requireSession(db, input.sessionId, input.userId);

  const [katmPipeline, cardPipeline] = await Promise.all([
    getPipeline(db, input.sessionId, 'katm'),
    getPipeline(db, input.sessionId, 'card_scoring'),
  ]);

  if (katmPipeline?.status !== 'completed') {
    throw Object.assign(new Error('katm_not_completed'), { statusCode: 409 });
  }
  if (cardPipeline?.status !== 'pending') {
    throw Object.assign(new Error('card_scoring_already_started'), { statusCode: 409 });
  }

  await db
    .update(scoringPipelines)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(scoringPipelines.id, cardPipeline.id));

  const katmResult = katmPipeline.result as KatmResult;

  try {
    const plumResult = await scoreCard(db, {
      plumCardId: input.plumCardId,
      pcType: input.pcType,
    });

    const coefficient = computeCoefficient(plumResult.score);
    const platformCreditLimit = Number(plumResult.limit);
    const now = new Date();

    await db
      .update(scoringPipelines)
      .set({
        status: 'completed',
        result: plumResult as unknown as Record<string, unknown>,
        completedAt: now,
      })
      .where(eq(scoringPipelines.id, cardPipeline.id));

    await db
      .update(scoringSessions)
      .set({ status: 'completed', scoredAt: now })
      .where(eq(scoringSessions.id, input.sessionId));

    const [user] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        middleName: users.middleName,
        passportSerial: users.passportSerial,
        passportNumber: users.passportNumber,
        pinfl: users.pinfl,
        phone: users.phone,
        birthDate: users.birthDate,
        gender: users.gender,
        nationality: users.nationality,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    const criteriaScores = buildCriteriaScores(
      plumResult,
      input.pcType,
      katmResult,
      user
        ? { birthDate: user.birthDate, gender: user.gender, nationality: user.nationality }
        : undefined,
    );

    // Look up any existing clients row for this PINFL (may span multiple merchants)
    const [existingClient] = user?.pinfl
      ? await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.pinfl, user.pinfl))
          .limit(1)
      : [];

    await db.insert(scoringHistories).values({
      clientId: existingClient?.id ?? null,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      middleName: user?.middleName ?? null,
      passportNumber: user?.passportNumber ?? null,
      passportSeries: user?.passportSerial ?? null,
      pinfl: user?.pinfl ?? null,
      phoneNumber: user?.phone ?? null,
      criteriaScores,
      scoreSum: plumResult.score.toString(),
      coefficient: coefficient.toString(),
      decision: plumResult.decision,
      platformCreditLimit,
    });

    return {
      scoreSum: plumResult.score,
      coefficient,
      decision: plumResult.decision,
      platformCreditLimit: plumResult.limit,
      criteriaScores,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await Promise.all([
      db
        .update(scoringPipelines)
        .set({ status: 'failed', error: errorMessage, completedAt: new Date() })
        .where(eq(scoringPipelines.id, cardPipeline.id)),
      db
        .update(scoringSessions)
        .set({ status: 'failed' })
        .where(eq(scoringSessions.id, input.sessionId)),
    ]);
    throw err;
  }
}
